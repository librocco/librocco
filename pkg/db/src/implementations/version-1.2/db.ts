/* eslint-disable @typescript-eslint/no-explicit-any */
import { BehaviorSubject, firstValueFrom, map, Observable, ReplaySubject, share, tap } from "rxjs";

import { debug } from "@librocco/shared";

import {
	BooksInterface,
	CouchDocument,
	DbStream,
	DesignDocument,
	InNoteList,
	MapReduceRow,
	NavListEntry,
	Replicator,
	VolumeStock
} from "@/types";
import { DatabaseInterface, WarehouseInterface, WarehouseListRow, OutNoteListRow, InNoteListRow } from "./types";

import { NEW_WAREHOUSE } from "@/constants";

import designDocs from "./designDocuments";
import { newWarehouse } from "./warehouse";
import { newBooksInterface } from "./books";
import { newDbReplicator } from "./replicator";
import { newView } from "./view";

import { scanDesignDocuments } from "@/utils/pouchdb";
import { newStock } from "./stock";

class Database implements DatabaseInterface {
	_pouch: PouchDB.Database;

	// The nav list streams are open when the db is instantiated and kept alive throughout the
	// lifetime of the instance to avoid wait times when the user navigates to the corresponding pages.
	#warehouseListStream: Observable<NavListEntry[]>;
	#outNoteListStream: Observable<NavListEntry[]>;
	#inNoteListStream: Observable<InNoteList>;

	#stockStream: Observable<VolumeStock[]>;

	constructor(db: PouchDB.Database) {
		this._pouch = db;

		const warehouseListCache = new BehaviorSubject<NavListEntry[]>([]);
		this.#warehouseListStream = this.view<WarehouseListRow>("v1_list/warehouses")
			.stream({})
			.pipe(
				map(({ rows }) => rows.map(({ key: id, value: { displayName = "" } }) => ({ id, displayName }))),
				share({ connector: () => warehouseListCache, resetOnRefCountZero: false })
			);

		const outNoteListCache = new BehaviorSubject<NavListEntry[]>([]);
		this.#outNoteListStream = this.view<OutNoteListRow>("v1_list/outbound")
			.stream({})
			.pipe(
				map(({ rows }) =>
					rows
						.filter(({ value: { committed } }) => !committed)
						.map(({ key: id, value: { displayName = "not-found" } }) => ({ id, displayName }))
				),
				share({ connector: () => outNoteListCache, resetOnRefCountZero: false })
			);

		const inNoteListCache = new BehaviorSubject<InNoteList>([]);
		this.#inNoteListStream = this.view<InNoteListRow>("v1_list/inbound")
			.stream({})
			.pipe(
				map(({ rows }) => aggregateInNoteList(rows)),
				share({ connector: () => inNoteListCache, resetOnRefCountZero: false })
			);

		const stockCache = new ReplaySubject<VolumeStock[]>(1);
		this.#stockStream = newStock(this)
			.stream({})
			.pipe(share({ connector: () => stockCache, resetOnRefCountZero: false }));

		// Currently we're using up to 14 listeners (21 when replication is enabled).
		// This increases the limit to a reasonable threshold, leaving some room for slower performance,
		// but will still show a warning if that number gets unexpectedly high (memory leak).
		this._pouch.setMaxListeners(30);

		// Initialise the streams
		firstValueFrom(this.#warehouseListStream);
		firstValueFrom(this.#inNoteListStream);
		firstValueFrom(this.#outNoteListStream);

		return this;
	}

	// #region setup
	replicate(): Replicator {
		return newDbReplicator(this);
	}

	stock(): Observable<VolumeStock[]> {
		return this.#stockStream;
	}

	async buildIndexes() {
		const indexes = scanDesignDocuments(designDocs);
		await Promise.all(indexes.map((view) => this._pouch.query(view)));
	}

	async init(): Promise<DatabaseInterface> {
		// Start initialisation with db setup:
		// - create the default warehouse (if it doesn't exist)
		// - update design documents
		const dbSetup: Promise<any>[] = [];

		// create default warehouse
		dbSetup.push(this.warehouse().create());

		// Upload design documents if any
		if (designDocs.length) {
			designDocs.forEach((dd) => {
				dbSetup.push(this.updateDesignDoc(dd));
			});
		}

		await Promise.all(dbSetup);
		return this;
	}

	updateDesignDoc(doc: DesignDocument) {
		return this._pouch.put(doc).catch((err) => {
			// If error is not a conflict, throw it back
			if (err.status != 409) {
				throw err;
			}
			// If the error was a conflict (document exists), update the document
			return this._pouch.get(doc._id).then(({ _rev }) => this._pouch.put({ ...doc, _rev }));
		});
	}
	// #endregion setup

	// #region instances
	view<R extends MapReduceRow, M extends CouchDocument = CouchDocument>(view: string) {
		return newView<R, M>(this._pouch, view);
	}

	books(): BooksInterface {
		return newBooksInterface(this);
	}

	warehouse(id?: string | typeof NEW_WAREHOUSE): WarehouseInterface {
		return newWarehouse(this, id);
	}
	// #endregion instances

	// #region queries
	async findNote(noteId: string) {
		// Remove trailing slash if any
		const id = noteId.replace(/\/$/, "");
		// Note id looks something like this: "v1/<warehouse-id>/<note-type>/<note-id>"
		const idSegments = id.split("/").filter(Boolean);

		// Validate the id is correct
		if (idSegments.length !== 4) {
			throw new Error(`Invalid note id: ${id}`);
		}

		// Get version number and warehouse id from the path segments
		const [v, w] = idSegments;
		const warehouseId = `${v}/${w}`;
		const [note, warehouse] = await Promise.all([this.warehouse(warehouseId).note(id).get(), this.warehouse(warehouseId).get()]);

		return note && warehouse ? { note, warehouse } : undefined;
	}

	async getWarehouseList() {
		return this.view<WarehouseListRow>("v1_list/warehouses")
			.query({})
			.then(({ rows }) => rows.map(({ key: id, value: { displayName = "" } }) => ({ id, displayName })));
	}
	// #endregion queries

	stream(): DbStream {
		return {
			warehouseList: (ctx: debug.DebugCtx) => this.#warehouseListStream.pipe(tap(debug.log(ctx, "db:warehouse_list:stream"))),
			outNoteList: (ctx: debug.DebugCtx) => this.#outNoteListStream.pipe(tap(debug.log(ctx, "db:out_note_list:stream"))),
			inNoteList: (ctx: debug.DebugCtx) => this.#inNoteListStream.pipe(tap(debug.log(ctx, "db:in_note_list:stream")))
		};
	}
}

export const newDatabase = (db: PouchDB.Database): DatabaseInterface => {
	return new Database(db);
};

// #region helpers
const aggregateInNoteList = (rows: InNoteListRow[]): InNoteList =>
	rows.reduce((acc, { key, value: { type, displayName = "", committed } }) => {
		if (type === "warehouse") {
			return [...acc, { id: key, displayName, notes: [] }];
		}

		// We're not displaying committed notes in the list
		if (committed) {
			return acc;
		}

		// Add note to the default warehouse (first in the list) as well as the corresponding warehouse (last in the list so far)
		acc[0].notes.push({ id: key, displayName });
		acc[acc.length - 1].notes.push({ id: key, displayName });
		return acc;
	}, [] as InNoteList);
// #endregion helpers
