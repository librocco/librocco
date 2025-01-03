/* eslint-disable @typescript-eslint/no-explicit-any */
import PouchDB from "pouchdb";
import { map, Observable, ReplaySubject, share, switchMap, tap, startWith, mergeMap, of } from "rxjs";

import { debug, wrapIter, map as mapIter, type StockMap } from "@librocco/shared";

import {
	BooksInterface,
	DbStream,
	Replicator,
	InNoteMap,
	NavEntry,
	NavMap,
	PluginInterfaceLookup,
	LibroccoPlugin,
	WarehouseDataMap,
	HistoryInterface,
	InventoryDatabaseConstructor
} from "@/types";
import {
	CouchDocument,
	DesignDocument,
	MapReduceRow,
	InventoryDatabaseInterface,
	WarehouseInterface,
	WarehouseListRow,
	OutNoteListRow,
	InNoteListRow,
	WarehouseData,
	ViewInterface,
	VersionedString
} from "./types";

import { NEW_WAREHOUSE } from "@/constants";

import { inventory as designDocs } from "./designDocuments";
import { newWarehouse } from "./warehouse";
import { newBooksInterface } from "./books";
import { newDbReplicator } from "./replicator";
import { newView } from "./view";
import { newStock } from "./stock";
import { newPluginsInterface, PluginsInterface } from "./plugins";
import { newHistoryProvider } from "./history";

import { scanDesignDocuments } from "./utils";

class Database implements InventoryDatabaseInterface {
	_pouch: PouchDB.Database;

	// The nav list streams are open when the db is instantiated and kept alive throughout the
	// lifetime of the instance to avoid wait times when the user navigates to the corresponding pages.
	#warehouseMapStream: Observable<WarehouseDataMap>;
	#outNoteListStream: Observable<NavMap>;
	#inNoteListStream: Observable<InNoteMap>;

	#stockStream: Observable<StockMap>;

	#plugins: PluginsInterface;

	#booksInterface?: BooksInterface;
	#history?: HistoryInterface;

	constructor(db: PouchDB.Database) {
		this._pouch = db;

		this.#plugins = newPluginsInterface();

		this.#warehouseMapStream = this.view<WarehouseListRow>("v1_list/warehouses")
			.stream({})
			.pipe(
				// Organise the warehouse design doc result as iterable of { id => NavEntry } pairs (NavEntry being a warehouse nav entry without 'totalBooks')
				map(({ rows }) =>
					wrapIter(rows).map(
						({ key: id, value }) => [id.split("/").pop()!, { ...value, displayName: value.displayName || "", totalBooks: -1 }] as const
					)
				), // Combine the stream with stock map stream to get the 'totalBooks' for each warehouse
				switchMap((warehouses) =>
					this.#stockStream.pipe(
						// Emit the initial warehouses without totalBooks
						startWith(warehouses),
						// Merge the warehouses with updated totalBooks information
						mergeMap((s) =>
							s === warehouses
								? of(warehouses)
								: of(
										mapIter(
											warehouses,
											([id, warehouse]) => [id, { ...warehouse, totalBooks: (s as StockMap).warehouse(id).size }] as const
										)
									)
						),
						// Multi-cast the potentially long-running mergeMap to prevent redundant execution fo each subscriber
						share()
					)
				),
				// Convert the iterable into a map of required type
				map((iter) => new Map<string, NavEntry<Pick<WarehouseData, "discountPercentage">>>(iter)),
				// Multi-cast the stream as a ReplaySubject which replays the last emitted value
				// in order to make view switching snappier after initial first load
				share({ connector: () => new ReplaySubject(1), resetOnRefCountZero: false })
			);

		this.#outNoteListStream = this.view<OutNoteListRow>("v1_list/outbound")
			.stream({})
			.pipe(
				map(
					({ rows }) =>
						new Map(
							wrapIter(rows)
								.filter(({ value: { committed } }) => !committed)
								.map(({ key: id, value: { displayName = "not-found", ...rest } }) => [id.split("/").pop()!, { displayName, ...rest }])
						)
				),
				share({ connector: () => new ReplaySubject(1), resetOnRefCountZero: false })
			);

		this.#inNoteListStream = this.view<InNoteListRow>("v1_list/inbound")
			.stream({})
			.pipe(
				map(({ rows }) => wrapIter(rows).reduce((acc, row) => acc.aggregate(row), new InNoteAggregator())),
				share({ connector: () => new ReplaySubject(1), resetOnRefCountZero: false })
			);

		this.#stockStream = newStock(this)
			.stream({})
			.pipe(share({ connector: () => new ReplaySubject(1), resetOnRefCountZero: false }));

		// Currently we're using up to 14 listeners (21 when replication is enabled).
		// This increases the limit to a reasonable threshold, leaving some room for slower performance,
		// but will still show a warning if that number gets unexpectedly high (memory leak).
		this._pouch.setMaxListeners(30);

		return this;
	}

	// #region setup
	replicate(): Replicator {
		return newDbReplicator(this);
	}

	getStock(): Promise<StockMap> {
		return newStock(this).query();
	}

	async buildIndices() {
		const indexes = scanDesignDocuments(designDocs);
		await Promise.all(indexes.map((view) => this._pouch.query(view)));
	}

	async init(): Promise<InventoryDatabaseInterface> {
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

	destroy() {
		return this._pouch.destroy();
	}
	// #endregion setup

	// #region instances
	view<R extends MapReduceRow, M extends CouchDocument = CouchDocument>(view: string): ViewInterface<R, M> {
		return newView<R, M>(this._pouch, view);
	}

	books(): BooksInterface {
		// We're caching the books interface to avoid creating multiple instances
		return this.#booksInterface ?? (this.#booksInterface = newBooksInterface(this));
	}

	warehouse(id?: string | typeof NEW_WAREHOUSE): WarehouseInterface {
		return newWarehouse(this, id);
	}

	history(): HistoryInterface {
		// The history provider is not instantiated automatically (as it's quite resource intensive),
		// but rather instantiated in a lazy manner when the history() method is called. We do, however,
		// cache history once it has been instantiated to avoid multiple instantiations.
		if (!this.#history) {
			this.#history = newHistoryProvider(this);
		}
		return this.#history;
	}

	plugin<T extends keyof PluginInterfaceLookup>(type: T): LibroccoPlugin<PluginInterfaceLookup[T]> {
		return this.#plugins.get(type);
	}

	// #endregion instances

	// #region queries
	async findNote(id: string) {
		const { rows } = await this.view<MapReduceRow<string, VersionedString>>("v1_notes/by_id").query();

		const noteId = rows.find(({ key }) => key === id)?.value;
		const warehouseId = noteId?.split("/")[1];

		const [note, warehouse] = await Promise.all([this.warehouse(warehouseId).note(id).get(), this.warehouse(warehouseId).get()]);

		return note && warehouse ? { note, warehouse } : undefined;
	}

	async getWarehouseDataMap(): Promise<WarehouseDataMap> {
		return this.view<WarehouseListRow>("v1_list/warehouses")
			.query({})
			.then(
				({ rows }) =>
					new Map(
						mapIter(rows, ({ key: id, value: { displayName = "", discountPercentage = 0, ...rest } }) => [
							id.split("/").pop()!,
							{ displayName, discountPercentage, ...rest }
						])
					)
			);
	}

	// #endregion queries

	stream(): DbStream {
		return {
			warehouseMap: (ctx: debug.DebugCtx) => this.#warehouseMapStream.pipe(tap(debug.log(ctx, "db:warehouse_list:stream"))),
			outNoteList: (ctx: debug.DebugCtx) => this.#outNoteListStream.pipe(tap(debug.log(ctx, "db:out_note_list:stream"))),
			inNoteList: (ctx: debug.DebugCtx) => this.#inNoteListStream.pipe(tap(debug.log(ctx, "db:in_note_list:stream"))),

			stock: () => this.#stockStream
		};
	}
}

export const newDatabase: InventoryDatabaseConstructor = (name, { test = false } = {}) => {
	const pouch = test ? new PouchDB(name) : new PouchDB(name);
	return new Database(pouch);
};

// #region helpers
class InNoteAggregator extends Map<string, NavEntry<{ notes: NavMap }>> implements InNoteMap {
	constructor() {
		super();
	}

	#currentWarehouseId = "";

	private getDefaultWarehouse() {
		return this.get("0-all");
	}

	private getCurrentWarehouse() {
		return this.get(this.#currentWarehouseId);
	}

	private addWarehouse(id: string, warehouse: NavEntry) {
		this.set(id, { ...warehouse, notes: new Map() });
		this.#currentWarehouseId = id;
	}

	private addNote(id: string, note: NavEntry) {
		// Add note to default warehouse and its corresponding warehouse
		this.getDefaultWarehouse()?.notes.set(id, note);
		this.getCurrentWarehouse()?.notes.set(id, note);
	}

	aggregate(row: InNoteListRow) {
		const {
			key,
			value: { type, displayName = "", committed, ...rest }
		} = row;

		if (type === "warehouse") {
			this.addWarehouse(key.split("/").pop()!, { displayName, ...rest });
			return this;
		}

		// We're not displaying committed notes in the list
		if (committed) {
			return this;
		}

		this.addNote(key.split("/").pop()!, { displayName, ...rest });

		return this;
	}
}

// #endregion helpers
