import { initWasm, locateFile } from "$lib/db/cr-sqlite/opfs";
import type { DB as _DB } from "@vlcn.io/crsqlite-wasm";
import { cryb64 } from "@vlcn.io/ws-common";
import rxtbl from "@vlcn.io/rx-tbl";

import schemaContent from "$lib/schemas/init?raw";
export { schemaContent };

import { type DB, type Change } from "./types";
import { idbPromise, idbTxn } from "../indexeddb";

export type DbCtx = { db: _DB; rx: ReturnType<typeof rxtbl> };

// DB Cache combines name -> promise { db ctx } rather than the awaited value as we want to
// chahe the DB as soon as the first time 'getInitializedDB' is called, so that all subsequent calls
// await the same promise (which may or may not be resolved by then).
const dbCache: Record<string, Promise<DbCtx>> = {};

export const schemaName = "init";
export const schemaVersion = cryb64(schemaContent);

async function getSchemaNameAndVersion(db: DB): Promise<[string, bigint] | null> {
	const nameRes = await db.execA<[string]>("SELECT value FROM crsql_master WHERE key = 'schema_name'");
	if (!nameRes?.length) return null;
	const [[name]] = nameRes;

	const versionRes = await db.execA<[string]>("SELECT value FROM crsql_master WHERE key = 'schema_version'");
	if (!versionRes?.length) throw new Error(`db has a schema name: ${name}, but no version`);
	const [[version]] = versionRes;

	return [name, BigInt(version)];
}

export async function getDB(dbname: string): Promise<_DB> {
	const sqlite = await initWasm(locateFile);
	const fname = dbname.endsWith(".sqlite3") ? dbname : `${dbname}.sqlite3`;
	return sqlite.open(fname);
}

export async function initializeDB(db: DB) {
	// Thought: This could probably be wrapped into a txn
	// not really: transactions are for DML, not for DDL
	// Apply the schema (initialise the db)
	await db.exec(schemaContent);

	// Store schema info in crsql_master
	await db.exec("INSERT OR REPLACE INTO crsql_master (key, value) VALUES (?, ?)", ["schema_name", schemaName]);
	await db.exec("INSERT OR REPLACE INTO crsql_master (key, value) VALUES (?, ?)", ["schema_version", schemaVersion]);
}

export class ErrDBCorrupted extends Error {
	constructor(message: string) {
		super(message);
		this.name = "ErrDBCorrupted";
	}
}

type ErrDBSchemaMismatchPayload = { wantName: string; wantVersion: bigint; gotName: string; gotVersion: bigint };
export class ErrDBSchemaMismatch extends Error {
	wantName: string;
	wantVersion: bigint;

	gotName: string;
	gotVersion: bigint;

	constructor({ wantName, wantVersion, gotName, gotVersion }: ErrDBSchemaMismatchPayload) {
		const message = [
			"DB name/schema mismatch:",
			`  req name: ${wantName}, got name: ${gotName}`,
			`  req version: ${wantVersion}, got version: ${gotVersion}`
		].join("\n");

		super(message);

		this.name = "ErrDBSchemaMismatch";

		this.wantName = wantName;
		this.wantVersion = wantVersion;

		this.gotName = gotName;
		this.gotVersion = gotVersion;
	}
}

/**
 * An intermediate function that checks for different (potentially bad) DB states:
 * - throws error(s) if need be
 * - initialises the DB if not initialised
 */
const checkAndInitializeDB = async (db: _DB) => {
	// Integrity check
	const [[res]] = await db.execA<[string]>("PRAGMA integrity_check");
	if (res !== "ok") {
		throw new ErrDBCorrupted(res);
	}

	// Check if DB initialized
	const schemaRes = await getSchemaNameAndVersion(db);
	if (!schemaRes) {
		await initializeDB(db);
		return db;
	}

	// Check schema name/version
	const [name, version] = schemaRes;
	if (name !== schemaName || version !== schemaVersion) {
		throw new ErrDBSchemaMismatch({ wantName: schemaName, wantVersion: schemaVersion, gotName: name, gotVersion: version });
	}

	return db;
};

export const getInitializedDB = async (dbname: string): Promise<DbCtx> => {
	// NOTE: DB Cache holds promises to prevent multiple initialisation attemtps:
	// - if initialization needed - cache the request (promise) immediately
	// - if cache exists, return the promise (which may or may not be resolved yet)

	if (dbCache[dbname]) {
		return await dbCache[dbname];
	}

	try {
		// Register the request (promise) immediately, to prevent multiple init requests
		// at the same time
		return await (dbCache[dbname] = getDB(dbname)
			.then(checkAndInitializeDB)
			.then((db) => ({ db, rx: rxtbl(db) })));
	} catch (err) {
		// If the request fails, however, (invalid DB state)
		// remove the cached promise so that we rerun the reqiuest on error fix + invalidateAll
		delete dbCache[dbname];
		throw err;
	}
};

export const getChanges = (db: DB, since: bigint | null = BigInt(0)): Promise<Change[]> => {
	const query = `SELECT
	  "table", "pk", "cid", "val", "col_version", "db_version", "site_id", "cl", "seq"
	  FROM crsql_changes
		WHERE db_version > ? AND site_id = crsql_site_id();`;
	return db.execA(query, [since]) as any;
};

export const applyChanges = async (db: DB, changes: readonly Change[]) => {
	const query = `
	  INSERT INTO crsql_changes
			("table", "pk", "cid", "val", "col_version", "db_version", "site_id", "cl", "seq")
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);`;
	for (const change of changes) {
		await db.exec(query, change as any);
	}
};

export const getSiteId = async (db: DB): Promise<Uint8Array> => {
	// Return the site id of the passed database
	const siteid = (await db.execA(`SELECT quote(crsql_site_id())`))[0][0];
	return siteid.slice(2, -1); // remove X'' quoting
};

export const getDBVersion = async (db: DB): Promise<bigint> => {
	// Get the db version of changes done locally in the passed database
	const version = (await db.execA(`SELECT crsql_db_version()`))[0][0];
	return BigInt(version);
};

export const getPeerDBVersion = async (db: DB, siteId: Uint8Array): Promise<bigint> => {
	// Get the last db version of updates for the given peer site id
	const version = (await db.execA(`SELECT max(db_version) FROM crsql_changes WHERE site_id = ?`, [siteId]))[0][0];
	return version ? BigInt(version) : BigInt(0);
};

/**
 * Clears the current cr-sqlite DB (in IndexedDB)
 *
 * NOTE: It doesn't actually delete the database itself, but rather clears all the data (leaving the empty DB)
 * as the former produced some problems flakiness.
 *
 * NOTE: Currently it clears all data for the DB - this deletes all DBs created using the current cr-sqlite stack
 * (e.g. we could have multiple DBs "dev", "foo", "bar-122", etc. created by cr-sqlite and all stored in "idb-batch-atomic" - this will delete them all)
 * TODO: Implement a more fine-grained approach - delete only the chunks associated with a particular DB name, e.g. "dev"
 */
export async function clearDb() {
	const dbName = "idb-batch-atomic";

	const db = await idbPromise(indexedDB.open(dbName));
	await idbTxn(db.transaction(db.objectStoreNames, "readwrite"), async (txn) => {
		for (const storeName of db.objectStoreNames) {
			await idbPromise(txn.objectStore(storeName).clear());
		}
	});
	db.close();

	// TODO: This is a bit inconsistent -- maybe clear only the "dev" db
	delete dbCache["dev"];
}
