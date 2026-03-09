import { get, derived, writable, type Readable } from "svelte/store";

import { getDB as getDBCore, getSchemaNameAndVersion, schemaContent, schemaName, schemaVersion } from "$lib/db/cr-sqlite/db";
import type { DBAsync, VFSWhitelist } from "$lib/db/cr-sqlite/core/types";

import type { App } from "./index";
import { waitForStore } from "./utils";
import { ErrDbNotInit, ErrDBIDMismatch, ErrDBCorrupted, ErrDBOpenTransient, ErrDbNotSet } from "./errors";
import { AppDbRx, type IAppDbRx } from "./rx";
import { checkOPFSFileExists } from "$lib/db/cr-sqlite/core/utils";
import { ErrDemoDBNotInitialised } from "$lib/db/cr-sqlite/errors";
import { DEMO_DB_NAME } from "$lib/constants";

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

const TRANSIENT_DB_OPEN_PATTERNS = [
	"database is locked",
	"sqlite_busy",
	"access handle",
	"could not acquire",
	"lock request denied",
	"lock"
];

const isTransientDbOpenError = (err: Error): boolean => {
	const message = err.message.toLowerCase();
	return TRANSIENT_DB_OPEN_PATTERNS.some((pattern) => message.includes(pattern));
};

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
	// The DB (this DB -- same dbid) is already initialised, skip
	if (dbid === app.db.dbid && get(app.db.state) === AppDbState.Ready) return;

	// DBID is different than the current one, reinitialise the DB
	app.db.dbid = dbid;
	app.db.setState(dbid, AppDbState.Loading);

	// Initialising — retry a few times to handle transient OPFS lock conflicts
	// (e.g. previous page's worker still holding the file handle after a rapid reload)
	const DB_OPEN_RETRIES = 3;
	const DB_OPEN_RETRY_DELAY_MS = 800;

	let db: DBAsync;
	let lastOpenError: Error | null = null;
	for (let attempt = 0; attempt < DB_OPEN_RETRIES; attempt++) {
		try {
			db = await getDBCore(dbid, vfs);
			lastOpenError = null;
			break;
		} catch (e) {
			lastOpenError = e as Error;
			if (attempt < DB_OPEN_RETRIES - 1) {
				console.warn(`[db] Failed to open database (attempt ${attempt + 1}/${DB_OPEN_RETRIES}), retrying...`, e);
				await new Promise((r) => setTimeout(r, DB_OPEN_RETRY_DELAY_MS));
			}
		}
	}
	if (lastOpenError) {
		if (isTransientDbOpenError(lastOpenError)) {
			const err = new ErrDBOpenTransient(`Failed to open database: ${lastOpenError.message}`);
			app.db.setState(dbid, AppDbState.Error, err);
			throw err;
		}

		app.db.setState(dbid, AppDbState.Error, lastOpenError);
		throw lastOpenError;
	}

	// Integrity check - if this fails, DB needs to be nuked
	const [[res]] = await db.execA<[string]>("PRAGMA integrity_check");
	if (res !== "ok") {
		const err = new ErrDBCorrupted(res);
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
		// Set the migration error internally (into DB)
		const err = new ErrDBCorrupted("Automigration failed: DB corrupted (see app.db.error for more info)");
		app.db.setState(dbid, AppDbState.Error, migrationError);
		// Throw general error (ErrDbCorrupted) for the caller
		throw err;
	}
};

export async function initializeDemoDb(app: App, vfs: VFSWhitelist) {
	const dbid = DEMO_DB_NAME;

	app.db.dbid = dbid;
	app.db.setState(dbid, AppDbState.Loading);

	// Whenever we encounter the error with the DB, we throw ErrDemoDBNotInitialised,
	// signalling the DB should be refetched, hence the helper.
	//
	// TODO: handle this a bit nicer
	const throwDemoDBError = () => {};

	// Check if the file exists: if not it needs to be fetched -- outside this function
	if (!(await checkOPFSFileExists(DEMO_DB_NAME))) {
		const err = new ErrDemoDBNotInitialised();
		app.db.setState(DEMO_DB_NAME, AppDbState.Error, err);
		throw err;
	}

	// Initialising
	const db = await getDBCore(dbid, vfs);

	// Integrity check - if this fails, DB needs to be nuked
	const [[res]] = await db.execA<[string]>("PRAGMA integrity_check");
	if (res !== "ok") {
		throwDemoDBError();
	}

	// Check if DB initialized (internally)
	const schemaRes = await getSchemaNameAndVersion(db);
	if (!schemaRes) {
		throwDemoDBError();
	}

	// Check schema name/version - auto-migrate if mismatch
	const [name, version] = schemaRes;
	if (name === schemaName && version === schemaVersion) {
		// All God - We're done here!
		app.db.setState(dbid, AppDbState.Ready, { db, vfs });
		return;
	}

	// Schema name / version mismatch -- automigrate
	app.db.setState(dbid, AppDbState.Migrating);

	try {
		const result = await db.automigrateTo(schemaName, schemaContent);
		console.log(`Auto-migration completed: ${result}`);
		app.db.setState(dbid, AppDbState.Ready, { db, vfs });
	} catch (migrationError) {
		// Migration failure is treated as a corrupted DB state - needs nuke
		console.error("Auto-migration failed:", migrationError);
		throwDemoDBError();
	}
}

/**
 * Waits for the application's database to finish initialization and returns the DB handle.
 *
 * @returns The application's `DBAsync` instance.
 * @throws ErrDbNotSet if database initialization has not started for this app.
 * @throws ErrDbNotInit if initialization failed or the DB handle is unavailable.
 */
export async function getDb(app: App): Promise<DBAsync> {
	// Throw if trying to access the DB either:
	// - before initalised
	// - errored out (should be reinitialised)
	const initialState = get(app.db.state);
	if (initialState === AppDbState.Error) {
		throw app.db.error ?? new ErrDbNotInit();
	}
	if (initialState < AppDbState.Loading) {
		throw new ErrDbNotSet();
	}

	// Wait until DB reaches a terminal init state.
	// This avoids hanging forever when init transitions to Error.
	await waitForStore(app.db.state, ($state) => $state === AppDbState.Ready || $state === AppDbState.Error);

	if (get(app.db.state) === AppDbState.Error) {
		throw app.db.error ?? new ErrDbNotInit();
	}
	if (!app.db.db) {
		throw new ErrDbNotInit();
	}
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
