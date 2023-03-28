/* eslint-disable @typescript-eslint/no-explicit-any */
import { BehaviorSubject, filter, firstValueFrom, map, Observable, ReplaySubject, share, tap } from "rxjs";

import { debug } from "@librocco/shared";

import { BooksInterface, DBInitState, DbStream, DesignDocument, InNoteList, NavListEntry } from "@/types";
import { DatabaseInterface, NoteListViewResp, WarehouseInterface, WarehouseListViewResp } from "./types";

import { NEW_WAREHOUSE } from "@/constants";

import designDocs from "./designDocuments";
import { newWarehouse } from "./warehouse";

import { newViewStream, replicateRemote, syncWithRemote } from "@/utils/pouchdb";
import { newBooksInterface } from "./books";
import { replicationError } from "./misc";

class Database implements DatabaseInterface {
	_pouch: PouchDB.Database;

	#initState = new BehaviorSubject<DBInitState>({ state: "void" });

	// The nav list streams are open when the db is instantiated and kept alive throughout the
	// lifetime of the instance to avoid wait times when the user navigates to the corresponding pages.
	#warehouseListStream: Observable<NavListEntry[]>;
	#outNoteListStream: Observable<NavListEntry[]>;
	#inNoteListStream: Observable<InNoteList>;

	constructor(db: PouchDB.Database) {
		this._pouch = db;

		const warehouseListCache = new ReplaySubject<NavListEntry[]>(1);
		this.#warehouseListStream = newViewStream<WarehouseListViewResp>({}, this._pouch, "v1_list/warehouses").pipe(
			map(({ rows }) => rows.map(({ key: id, value: { displayName = "" } }) => ({ id, displayName }))),
			share({ connector: () => warehouseListCache })
		);

		const outNoteListCache = new ReplaySubject<NavListEntry[]>(1);
		this.#outNoteListStream = newViewStream<NoteListViewResp>({}, this._pouch, "v1_list/outbound").pipe(
			map(({ rows }) =>
				rows
					.filter(({ value: { committed } }) => !committed)
					.map(({ key: id, value: { displayName = "" } }) => ({ id, displayName }))
			),
			share({ connector: () => outNoteListCache })
		);

		const inNoteListCache = new ReplaySubject<InNoteList>(1);
		this.#inNoteListStream = newViewStream<NoteListViewResp>({}, this._pouch, "v1_list/inbound").pipe(
			map(({ rows }) =>
				rows.reduce((acc, { key, value: { type, displayName = "", committed } }) => {
					if (type === "warehouse") {
						return [...acc, { id: key, displayName, notes: [] }];
					}
					if (committed) {
						return acc;
					}
					// Add note to the default warehouse (first in the list) as well as the corresponding warehouse (last in the list so far)
					acc[0].notes.push({ id: key, displayName });
					acc[acc.length - 1].notes.push({ id: key, displayName });
					return acc;
				}, [] as InNoteList)
			),
			share({ connector: () => inNoteListCache })
		);

		// Currently we're using up to 14 listeners (21 when replication is enabled).
		// This increases the limit to a reasonable threshold, leaving some room for slower performance,
		// but will still show a warning if that number gets unexpectedly high (memory leak).
		this._pouch.setMaxListeners(30);
	}

	replicate(ctx: debug.DebugCtx) {

		/**
		 * a transient replication to the remote db (from the local db) - should resolve on done
		 */
		const to = (url: string) => {
			debug.log(ctx, "init_db:replication:started");
			this.#initState.next({ state: "replicating" });

			// Pull data from the remote db (if provided)
			replicateRemote(ctx, this._pouch, url, true)
				.then(() =>
					firstValueFrom(
						this.stream()
							.warehouseList({})
							.pipe(filter((list) => list.length > 0))
					)
				)
				.then(() => {
					debug.log(ctx, "init_db:replication:initial_replication_done")({});
					this.#initState.next({ state: "ready" });
				})
				.catch((err) => {
					// If remote db is not available, log the error and continue.
					console.error(err);
					console.error(replicationError);
				});
		};

		/**
		 * a transient replication from the remote db (to the local db)
		 */

		const from = (url: string) => {
			debug.log(ctx, "init_db:replication:started");
			this.#initState.next({ state: "replicating" });

			// Pull data from the remote db (if provided)
			replicateRemote(ctx, this._pouch, url)
				.then(() =>
					firstValueFrom(
						this.stream()
							.warehouseList({})
							.pipe(filter((list) => list.length > 0))
					)
				)
				.then(() => {
					debug.log(ctx, "init_db:replication:initial_replication_done")({});
					this.#initState.next({ state: "ready" });
				})
				.catch((err) => {
					// If remote db is not available, log the error and continue.
					console.error(err);
					console.error(replicationError);
				});
		};

		/**
		 * a transient, two way replication - this would be really handy for initial db setup (each time the UI starts)
		 */
		const sync = (url: string) => {
			try {
				// Start live sync between local and remote db
				syncWithRemote(ctx, this._pouch, url);
			} catch (err) {
				// If remote db is not available, log the error and continue.
				console.error(err);
				console.error(replicationError);
			}
		};

		/**
		 * a live replication (used in the app, to, at least, replicate to one couch node)
		 */
		const live = (url: string) => {
			try {
				// Start live sync between local and remote db
				syncWithRemote(ctx, this._pouch, url, true);
			} catch (err) {
				// If remote db is not available, log the error and continue.
				console.error(err);
				console.error(replicationError);
			}
		};

		return {
			to,
			from,
			sync,
			live
		};
	}

	init(ctx: debug.DebugCtx): void {
		debug.log(ctx, "init_db:started")({});
		const initState = this.#initState.value.state;

		// Take care of idempotency: don't allow any operations
		// if initialised or initialisation in progress.
		if (initState === "ready") {
			debug.log(ctx, "init_db:already_initialised")({});
		}
		if (["initialising"].includes(initState)) {
			debug.log(ctx, "init_db:initialisation_in_progress")({});
		}

		// Start initialisation with db setup:
		// - create the default warehouse (if it doesn't exist)
		// - update design documents
		const dbSetup: Promise<any>[] = [];

		// create default warehouse
		dbSetup.push(this.warehouse().create());

		// Set initialisation state to 'initialising'
		this.#initState.next({ state: "initialising" });

		// Upload design documents if any
		if (designDocs.length) {
			designDocs.forEach((dd) => {
				dbSetup.push(this.updateDesignDoc(dd));
			});
		}

		// Notice we're not awaiting the 'dbSetup' promises here as we want to
		// return immediately and communicate with the called through db's initState stream
		Promise.all(dbSetup).then(() => {
			debug.log(ctx, "init_db:initialisation_done")({});
			this.#initState.next({ state: "ready" });
		});
	}

	books(): BooksInterface {
		return newBooksInterface(this);
	}

	warehouse(id?: string | typeof NEW_WAREHOUSE): WarehouseInterface {
		return newWarehouse(this, id);
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

	async findNote(id: string) {
		// Note id looks something like this: "v1/<warehouse-id>/<note-type>/<note-id>"
		const idSegments = id.split("/");

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
			initState: (ctx: debug.DebugCtx) => this.#initState.pipe(tap(debug.log(ctx, "db:init_state:stream"))),
			warehouseList: (ctx: debug.DebugCtx) => this.#warehouseListStream.pipe(tap(debug.log(ctx, "db:warehouse_list:stream"))),
			outNoteList: (ctx: debug.DebugCtx) => this.#outNoteListStream.pipe(tap(debug.log(ctx, "db:out_note_list:stream"))),
			inNoteList: (ctx: debug.DebugCtx) => this.#inNoteListStream.pipe(tap(debug.log(ctx, "db:in_note_list:stream")))
		};
	}
}

export const newDatabase = (db: PouchDB.Database): Database => {
	return new Database(db);
};
