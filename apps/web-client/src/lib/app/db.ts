import { get, derived, writable, type Readable } from "svelte/store";
import tblrx from "@vlcn.io/rx-tbl";

import { getDB as getDBCore, getSchemaNameAndVersion, schemaContent, schemaName, schemaVersion } from "$lib/db/cr-sqlite/db";
import type { DBAsync, VFSWhitelist } from "$lib/db/cr-sqlite/core/types";

import type { App } from "./index";
import { waitForStore } from "./utils";
import { ErrDbNotInit, ErrDBIDMismatch, ErrDBCorrupted, ErrDbNotSet } from "./errors";
import { AppDbRx, type IAppDbRx } from "./rx";

// ---------------------------------- Structs ---------------------------------- //
/**
 * Phases of DB initialization:
 * - Null: Not started:
 *   - this (starting the initialisation) shold be done before any other DB interaction (starting of initialisation)
 *   - app DB handlers should throw if any other DB interaction attempted before this is moved to at-least "loading"
 * - Error: Unrecoverable error (requires nuke)
 * - Loading: Loading DB/WASM
 * - Migrating: Running auto-migration
 * - Ready: DB ready for use
 */
export enum AppDbState {
	Null,
	Error,
	Loading,
	Migrating,
	Ready
}

type DbCtx = { db: DBAsync; vfs: VFSWhitelist };

type SetStateReturn = { ok: true } | { ok: false; error: Error };

export interface IAppDb {
	state: Readable<AppDbState>;
	error: Error | null;
	dbid: string | null;
	ready: Readable<boolean>;
	db: DBAsync | null;
	vfs: VFSWhitelist;

	rx: IAppDbRx;

	setState(dbid: string, state: Exclude<AppDbState, AppDbState.Error | AppDbState.Ready>): SetStateReturn;
	setState(dbid: string, state: AppDbState.Error, error: Error): SetStateReturn;
	setState(dbid: string, state: AppDbState.Ready, dbCtx: DbCtx): SetStateReturn;
}

export class AppDb implements IAppDb {
	// -------------- STATE -------------- //
	#state = writable(AppDbState.Null);
	get state() {
		return this.#state as Readable<AppDbState>;
	}

	#error: Error | null = null;
	get error() {
		return this.#error;
	}

	#dbid: string | null;
	get dbid() {
		return this.#dbid;
	}
	set dbid(value: string) {
		this.#dbid = value;
	}

	#ready = derived([this.state], ([$s]) => $s == AppDbState.Ready);
	get ready() {
		return this.#ready;
	}

	#db: DBAsync | null = null;
	get db() {
		return this.#db;
	}

	#vfs: VFSWhitelist;
	get vfs() {
		return this.#vfs;
	}

	#rx: IAppDbRx = new AppDbRx();
	get rx() {
		return this.#rx;
	}

	setState(dbid: string, state: Exclude<AppDbState, AppDbState.Error | AppDbState.Ready>): SetStateReturn;
	setState(dbid: string, state: AppDbState.Error, error: Error): SetStateReturn;
	setState(dbid: string, state: AppDbState.Ready, dbCtx: DbCtx): SetStateReturn;
	setState(dbid: string, state: AppDbState, param2?: Error | DbCtx): SetStateReturn {
		// Return DBID mismatch error:
		// - this could happen if we switch the DB before the current one had finished initialising
		// - I don't expect this to happen really
		if (dbid !== this.#dbid) {
			return { ok: false, error: new ErrDBIDMismatch(this.#dbid, dbid) };
		}

		if (state === AppDbState.Error) {
			this.#error = param2 as Error;
		}

		if (state === AppDbState.Ready) {
			const { db, vfs } = param2 as DbCtx;
			this.#db = db;
			this.#rx.invalidate(db); // "invalidate" the Rx object to set the newly initialised DB
			this.#vfs = vfs;
		}

		this.#state.set(state);
		return { ok: true };
	}
}

// ---------------------------------- Functions ---------------------------------- //
export const initializeDb = async (app: App, dbid: string, vfs: VFSWhitelist): Promise<DbCtx> => {
	// The DB (this DB -- same dbid) is already initialised (or being initialised), skip
	if (dbid === app.db.dbid) return;

	// DBID is different than the current one, reinitialise the DB
	app.db.dbid = dbid;
	app.db.setState(dbid, AppDbState.Loading);

	// Initialising
	const db = await getDBCore(dbid, vfs);

	// Integrity check - if this fails, DB needs to be nuked
	const [[res]] = await db.execA<[string]>("PRAGMA integrity_check");
	if (res !== "ok") {
		const err = new ErrDBCorrupted(res);
		// TODO: handle an edge case where DB corrupted, but we've already switched to another DB.
		// This is currently not implemented, but I imagine (give the app flows) this will virtually never happen.
		app.db.setState(dbid, AppDbState.Error, err);
		throw err;
	}

	// Check if DB initialized (internally)
	const schemaRes = await getSchemaNameAndVersion(db);
	if (!schemaRes) {
		// Apply the schema (initialise the db)
		await db.exec(schemaContent);

		// Store schema info in crsql_master
		await db.exec("INSERT OR REPLACE INTO crsql_master (key, value) VALUES (?, ?)", ["schema_name", schemaName]);
		await db.exec("INSERT OR REPLACE INTO crsql_master (key, value) VALUES (?, ?)", ["schema_version", schemaVersion]);

		// TODO: maybe handle a case when the DB had switched (and we simply throw away this DB),
		// e.g. console.warn or return back to the caller, right now it's not a priority and I don't imagine it
		// happening in production anyway
		app.db.setState(dbid, AppDbState.Ready, { db, vfs });

		return;
	}

	// Check schema name/version - auto-migrate if mismatch
	const [name, version] = schemaRes;
	if (name === schemaName && version === schemaVersion) {
		// All God - We're done here!
		//
		// TODO: maybe handle a case when the DB had switched (and we simply throw away this DB),
		// e.g. console.warn or return back to the caller, right now it's not a priority and I don't imagine it
		// happening in production anyway
		app.db.setState(dbid, AppDbState.Ready, { db, vfs });
		return;
	}

	// Schema name / version mismatch -- automigrate
	if (!app.db.setState(dbid, AppDbState.Migrating).ok) {
		// This probably means the DB currently being initialised is no longer the active DB
		// TODO: handle this (e.g. show a console.log or return to caller), but low priority as low probability of happening
		return;
	}

	try {
		const result = await db.automigrateTo(schemaName, schemaContent);
		console.log(`Auto-migration completed: ${result}`);
		// TODO: maybe handle a case when the DB had switched (and we simply throw away this DB),
		// e.g. console.warn or return back to the caller, right now it's not a priority and I don't imagine it
		// happening in production anyway
		app.db.setState(dbid, AppDbState.Ready, { db, vfs });
	} catch (migrationError) {
		// Migration failure is treated as a corrupted DB state - needs nuke
		console.error("Auto-migration failed:", migrationError);
		app.db.setState(dbid, AppDbState.Ready, { db, vfs });
		throw new ErrDBCorrupted(`Migration failed: ${migrationError instanceof Error ? migrationError.message : String(migrationError)}`);
	}
};

/**
 * Retrieve the DB in an async manner - this waits for DB initialisation, thus
 * ensuring we won't retrieve the DB before initialised.
 *
 * NOTE: this is **the preferred** way of retrieving the DB for queries/inserts/updates
 * as it ensures we're interacting with the correct DB instante at every point in time.
 */
export async function getDb(app: App): Promise<DBAsync> {
	// Throw if trying to access the DB either:
	// - before initalised
	// - errored out (should be reinitialised)
	if (get(app.db.state) < AppDbState.Loading) {
		throw new ErrDbNotSet();
	}
	// Wait for initialisation
	//
	// NOTE: we're not handling the case when DB errors out while
	// we're waiting, but it's probably ok to rely on initialisation (updating) process
	await waitForStore(app.ready, ($ready) => $ready);
	return app.db.db;
}

/**
 * Instead of using `dbCtx.rx.(...)` subscriptions directly, we wrap them in this 'safety'
 * convenience function that throws if the DB is not initialised (ensuring the correct loading/initialisation order)
 */
export function getDbRx(app: App) {
	if (!get(app.db.ready)) {
		throw new ErrDbNotInit();
	}
	return app.db.rx;
}

export function getVfs(app: App) {
	if (!get(app.db.ready)) {
		throw new ErrDbNotInit();
	}
	return app.db.vfs;
}
