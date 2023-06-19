import { concat, filter, firstValueFrom, from, map, mergeMap, Observable, reduce, switchMap } from "rxjs";

import { Logger, ValueWithMeta } from "@librocco/rxjs-logger";
import { debug } from "@librocco/shared";

import { VolumeStock } from "@/types";
import { DatabaseInterface, WarehouseData, NoteData } from "./types";

import { newChangesStream } from "@/utils/pouchdb";
import { sortBooks, versionId } from "@/utils/misc";

export interface StockInterface {
	changes: () => PouchDB.Core.Changes<any>;
	query: () => Promise<any>;
	stream: (ctx: debug.DebugCtx) => Observable<ValueWithMeta<VolumeStock[]>>;
}

type Doc = NoteData | WarehouseData;

class Stock implements StockInterface {
	#db: DatabaseInterface;

	#logger: Logger;

	_id: string;
	options: Parameters<PouchDB.Database["allDocs"]>[0];

	constructor(db: DatabaseInterface, id: string, logger: Logger) {
		this.#db = db;

		this.#logger = logger;

		this._id = id;
		// Start from "v1/" (to collect the outbound notes, belonging to the default warehouse)
		const startkey = versionId("");
		// End with "v10" (as '0' is the next lexical character after '/'), ending the 'v1/' namespace
		const endkey = startkey.replace(/.$/, (c) => String.fromCharCode(c.charCodeAt(0) + 1));
		this.options = {
			startkey,
			endkey
		};
	}

	changes() {
		return this.#db._pouch.changes<Doc>({
			...this.options,
			include_docs: false,
			since: "now",
			live: true
		});
	}

	changesStream(ctx: debug.DebugCtx) {
		return newChangesStream(ctx, this.changes());
	}

	async query() {
		const source = from(this.#db._pouch.allDocs({ ...this.options, include_docs: true }));
		const pipeline = source.pipe(
			switchMap(({ rows }) => from(rows)),
			map(({ doc }) => doc as Doc),
			filter((doc): doc is NoteData => doc?.docType === "note"),
			filter(({ committed, entries }) => Boolean(committed && entries?.length)),
			mergeMap(({ entries, noteType }) => from(entries).pipe(map((entry) => ({ ...entry, noteType })))),
			reduce((acc, curr) => acc.aggregate(curr), new MapAggregator(this._id))
		);
		const res = await firstValueFrom(pipeline);
		return [...res.values()].sort(sortBooks);
	}

	stream(ctx: debug.DebugCtx) {
		const trigger = concat(from(Promise.resolve()), this.changesStream(ctx));
		const pipeline = trigger.pipe(
			this.#logger.start(ctx.name),
			this.#logger.log(
				"stock_query",
				switchMap(() => this.query())
			)
		);
		return pipeline;
	}
}

class MapAggregator extends Map<string, VolumeStock> {
	_id: string;

	constructor(id: string) {
		super();
		this._id = id;
	}

	aggregate({ isbn, quantity, noteType, warehouseId }: VolumeStock & Pick<NoteData, "noteType">) {
		if (
			// Skip notes not belonging to this warehouse
			![versionId(warehouseId), versionId("0-all")].includes(versionId(this._id)) ||
			// Skip entries with zero quantity
			quantity === 0
		) {
			return this;
		}

		const key = `${isbn}-${warehouseId}`;
		const delta = noteType === "inbound" ? quantity : -quantity;

		const existing = this.get(key);
		if (existing) {
			existing.quantity += delta;
			if (existing.quantity === 0) {
				this.delete(key);
			}

			return this;
		}

		this.set(key, { isbn, quantity: delta, warehouseId });

		return this;
	}
}

export const newStock = (db: DatabaseInterface, id: string, logger: Logger) => new Stock(db, id, logger);
