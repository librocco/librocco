/* eslint-disable @typescript-eslint/no-explicit-any */
import { BehaviorSubject, firstValueFrom, map, Observable, share } from "rxjs";

import { Logger, ValueWithMeta } from "@librocco/rxjs-logger";

import { BooksInterface, CouchDocument, DbStream, DesignDocument, InNoteList, MapReduceRow, NavListEntry, Replicator } from "@/types";
import { DatabaseInterface, WarehouseInterface, WarehouseListRow, OutNoteListRow, InNoteListRow } from "./types";

import { NEW_WAREHOUSE } from "@/constants";

import designDocs from "./designDocuments";
import { newWarehouse } from "./warehouse";
import { newBooksInterface } from "./books";
import { newDbReplicator } from "./replicator";
import { newView } from "./view";

import { scanDesignDocuments } from "@/utils/pouchdb";

class Database implements DatabaseInterface {
	_pouch: PouchDB.Database;

	#logger: Logger;

	// The nav list streams are open when the db is instantiated and kept alive throughout the
	// lifetime of the instance to avoid wait times when the user navigates to the corresponding pages.
	#warehouseListStream: Observable<ValueWithMeta<NavListEntry[]>>;
	#outNoteListStream: Observable<ValueWithMeta<NavListEntry[]>>;
	#inNoteListStream: Observable<ValueWithMeta<InNoteList>>;

	constructor(db: PouchDB.Database, logger: Logger) {
		this._pouch = db;

		this.#logger = logger;

		const warehouseListCache = new BehaviorSubject<ValueWithMeta<NavListEntry[]>>({ value: [] });
		const warehouseListCtx = { name: "warehouse_list_internal" };
		this.#warehouseListStream = this.view<WarehouseListRow>("v1_list/warehouses")
			.stream(warehouseListCtx)
			.pipe(
				this.#logger.log(
					"map::rows_to_nav_list",
					map(({ rows }) => rows.map(({ key: id, value: { displayName = "" } }) => ({ id, displayName })))
				),
				share({ connector: () => warehouseListCache, resetOnRefCountZero: false })
			);

		const outNoteListCache = new BehaviorSubject<ValueWithMeta<NavListEntry[]>>({ value: [] });
		const outNoteListCtx = { name: "out_note_list_internal" };
		this.#outNoteListStream = this.view<OutNoteListRow>("v1_list/outbound")
			.stream(outNoteListCtx)
			.pipe(
				this.#logger.log(
					"map::rows_to_nav_list",
					map(({ rows }) =>
						rows
							.filter(({ value: { committed } }) => !committed)
							.map(({ key: id, value: { displayName = "not-found" } }) => ({ id, displayName }))
					)
				),
				share({ connector: () => outNoteListCache, resetOnRefCountZero: false })
			);

		const inNoteListCache = new BehaviorSubject<ValueWithMeta<InNoteList>>({ value: [] });
		const inNoteListCtx = { name: "in_note_list_internal" };
		this.#inNoteListStream = this.view<InNoteListRow>("v1_list/inbound")
			.stream(inNoteListCtx)
			.pipe(
				this.#logger.log(
					"map::rows_to_in_note_list",
					map(({ rows }) => aggregateInNoteList(rows))
				),
				share({ connector: () => inNoteListCache, resetOnRefCountZero: false })
			);

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

	replicate(): Replicator {
		return newDbReplicator(this);
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

	view<R extends MapReduceRow, M extends CouchDocument = CouchDocument>(view: string) {
		return newView<R, M>(this._pouch, this.#logger, view);
	}

	books(): BooksInterface {
		return newBooksInterface(this);
	}

	warehouse(id?: string | typeof NEW_WAREHOUSE): WarehouseInterface {
		return newWarehouse(this, this.#logger, id);
	}

	updateDesignDoc(doc: DesignDocument): Promise<any> {
		return this._pouch.put(doc).catch((err) => {
			// If error is not a conflict, throw it back
			if (err.status != 409) {
				throw err;
			}
			// If the error was a conflict (document exists), update the document
			return; // this._pouch.get(doc._id).then(({ _rev }) => this._pouch.put({ ...doc, _rev }));
		});
	}

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

	stream(): DbStream {
		return {
			warehouseList: () => this.#warehouseListStream,
			outNoteList: () => this.#outNoteListStream,
			inNoteList: () => this.#inNoteListStream
		};
	}
}

export const newDatabase = (db: PouchDB.Database, logger: Logger): DatabaseInterface => {
	return new Database(db, logger);
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
