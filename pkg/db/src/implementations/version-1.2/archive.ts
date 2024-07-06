import { BehaviorSubject } from "rxjs";

import { VolumeStock, debug } from "@librocco/shared";

import { DatabaseInterface } from "@/types";
import { ArchiveInterface, StockArchiveDoc, StockArchiveInterface } from "./types";

import { DocType } from "@/enums";

import { versionId } from "./utils";
import { isEmpty, runAfterCondition } from "@/utils/misc";

class Archive implements ArchiveInterface {
	#db: DatabaseInterface;

	constructor(db: DatabaseInterface) {
		this.#db = db;
	}

	stock(): StockArchiveInterface {
		return new StockArchive(this.#db);
	}
}

export function newArchive(db: DatabaseInterface): ArchiveInterface {
	return new Archive(db);
}

class StockArchive implements StockArchiveInterface {
	#db: DatabaseInterface;

	#initialized = new BehaviorSubject(false);

	_id = versionId(`archive/stock`);
	_rev?: string;
	month = "";
	entries: VolumeStock[] = [];
	docType = DocType.StockArchive;

	constructor(db: DatabaseInterface) {
		this.#db = db;

		this.#db._pouch
			.get<StockArchiveDoc>(this._id)
			.catch(() => ({} as StockArchiveDoc))
			.then((doc) => doc)
			.then(this._updateInstance.bind(this))
			.then(() => this.#initialized.next(true));
	}

	/**
	 * Update field is a method for internal usage, used to update the local field, if the value is provided
	 */
	private _updateField<K extends keyof StockArchive>(field: K, value?: StockArchive[K]) {
		if (value !== undefined) {
			this[field] = value as any;
		}

		return this;
	}

	/**
	 * Update instance is a method for internal usage, used to update the instance with the data (doesn't update the DB)
	 */
	private _updateInstance(data: Partial<Omit<StockArchiveDoc, "_id">>): StockArchiveInterface {
		// No-op if the data is empty
		if (isEmpty(data)) {
			return this;
		}

		// Update the data with provided fields
		this._updateField("_rev", data._rev);
		this._updateField("month", data.month);
		this._updateField("entries", data.entries);

		return this;
	}

	/**
	 * Update is private as it's here for internal usage, while all updates to warehouse document
	 * from outside the instance have their own designated methods.
	 */
	private _update(ctx: debug.DebugCtx, data: Partial<StockArchiveDoc>) {
		return runAfterCondition(async () => {
			debug.log(ctx, "stock_archive:update")({ data });

			const updatedData = { ...this, ...data, updatedAt: new Date().toISOString() };
			debug.log(ctx, "stock_archive:updating")({ updatedData });
			const { rev } = await this.#db._pouch.put<StockArchiveDoc>(updatedData);
			debug.log(ctx, "stock_archive:updated")({ updatedData, rev });

			return this;
		}, this.#initialized);
	}

	get(): Promise<StockArchiveInterface> {
		return runAfterCondition(async () => this, this.#initialized);
	}

	async upsert(ctx: debug.DebugCtx, month: string, entries: VolumeStock[]): Promise<StockArchiveInterface> {
		return this._update(ctx, { month, entries });
	}
}
