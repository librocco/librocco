import { cryb64 } from "@vlcn.io/ws-common";
import rxtbl from "@vlcn.io/rx-tbl";

import schemaContent from "$lib/schemas/init?raw";
export { schemaContent };

import type { DBAsync, TXAsync, Change, VFSWhitelist } from "./types";

import { getMainThreadDB, getWorkerDB } from "./core";
import { DEFAULT_VFS } from "./core/constants";
import { ErrDBCorrupted } from "./errors";

export type DbCtx = { db: DBAsync; rx: ReturnType<typeof rxtbl>; vfs: VFSWhitelist };

export const schemaName = "init";
export const schemaVersion = cryb64(schemaContent);

export async function getSchemaNameAndVersion(db: TXAsync): Promise<[string, bigint] | null> {
	const nameRes = await db.execA<[string]>("SELECT value FROM crsql_master WHERE key = 'schema_name'");
	if (!nameRes?.length) return null;
	const [[name]] = nameRes;

	const versionRes = await db.execA<[string]>("SELECT value FROM crsql_master WHERE key = 'schema_version'");
	if (!versionRes?.length) throw new Error(`db has a schema name: ${name}, but no version`);
	const [[version]] = versionRes;

	return [name, BigInt(version)];
}

export async function getDB(dbname: string, vfs: VFSWhitelist = DEFAULT_VFS): Promise<DBAsync> {
	const mainThreadVFS = new Set<VFSWhitelist>(["asyncify-idb-batch-atomic", "asyncify-opfs-any-context"]);
	if (mainThreadVFS.has(vfs)) {
		console.log(`using main thread db with vfs: ${vfs}`);
		return getMainThreadDB(dbname, vfs);
	}
	console.log(`using worker db with vfs: ${vfs}`);
	return getWorkerDB(dbname, vfs);
}

export async function initializeDB(db: TXAsync) {
	// Thought: This could probably be wrapped into a txn
	// not really: transactions are for DML, not for DDL
	// Apply the schema (initialise the db)
	await db.exec(schemaContent);

	// Store schema info in crsql_master
	await db.exec("INSERT OR REPLACE INTO crsql_master (key, value) VALUES (?, ?)", ["schema_name", schemaName]);
	await db.exec("INSERT OR REPLACE INTO crsql_master (key, value) VALUES (?, ?)", ["schema_version", schemaVersion]);
}

/**
 * An intermediate function that checks for different (potentially bad) DB states:
 * - throws ErrDBCorrupted if integrity check fails (requires nuke)
 * - initializes the DB if not initialized
 * - auto-migrates if schema version mismatch (no user interaction needed)
 */
const checkAndInitializeDB = async (db: DBAsync): Promise<DBAsync> => {
	// Integrity check - if this fails, DB needs to be nuked
	const [[res]] = await db.execA<[string]>("PRAGMA integrity_check");
	if (res !== "ok") {
		throw new ErrDBCorrupted(res);
	}

	// Check if DB initialized
	const schemaRes = await getSchemaNameAndVersion(db);
	if (!schemaRes) {
		// Fresh DB - initialize it
		await initializeDB(db);
		return db;
	}

	// Check schema name/version - auto-migrate if mismatch
	const [name, version] = schemaRes;
	if (name !== schemaName || version !== schemaVersion) {
		console.log(`Schema mismatch detected. Current: ${name}@${version}, Expected: ${schemaName}@${schemaVersion}`);
		console.log("Auto-migrating database...");

		try {
			const result = await db.automigrateTo(schemaName, schemaContent);
			console.log(`Auto-migration completed: ${result}`);
		} catch (migrationError) {
			console.error("Auto-migration failed:", migrationError);
			// Migration failure is treated as a corrupted DB state - needs nuke
			throw new ErrDBCorrupted(`Migration failed: ${migrationError instanceof Error ? migrationError.message : String(migrationError)}`);
		}
	}

	return db;
};

export const getInitializedDB = async (dbname: string, vfs: VFSWhitelist = DEFAULT_VFS): Promise<DbCtx> => {
	try {
		// Register the request (promise) immediately, to prevent multiple init requests
		// at the same time
		const initialiser = getDB(dbname, vfs)
			.then(checkAndInitializeDB)
			.then((db) => {
				const ctx = { db, rx: rxtbl(db), vfs };
				return ctx;
			});

		return await initialiser;
	} catch (err) {
		// Update init store with error

		throw err;
	}
};

export const getChanges = (db: TXAsync, since: bigint | null = BigInt(0)): Promise<Change[]> => {
	const query = `SELECT
	  "table", "pk", "cid", "val", "col_version", "db_version", "site_id", "cl", "seq"
	  FROM crsql_changes
		WHERE db_version > ? AND site_id = crsql_site_id();`;
	return db.execA(query, [since]) as any;
};

export const applyChanges = async (db: TXAsync, changes: readonly Change[]) => {
	const query = `
	  INSERT INTO crsql_changes
			("table", "pk", "cid", "val", "col_version", "db_version", "site_id", "cl", "seq")
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);`;
	for (const change of changes) {
		await db.exec(query, change as any);
	}
};

export const getSiteId = async (db: TXAsync): Promise<Uint8Array> => {
	// Return the site id of the passed database
	const siteid = (await db.execA(`SELECT quote(crsql_site_id())`))[0][0];
	return siteid.slice(2, -1); // remove X'' quoting
};

export const getDBVersion = async (db: TXAsync): Promise<bigint> => {
	// Get the db version of changes done locally in the passed database
	const version = (await db.execA(`SELECT crsql_db_version()`))[0][0];
	return BigInt(version);
};

export const getPeerDBVersion = async (db: TXAsync, siteId: Uint8Array): Promise<bigint> => {
	// Get the last db version of updates for the given peer site id
	const version = (await db.execA(`SELECT max(db_version) FROM crsql_changes WHERE site_id = ?`, [siteId]))[0][0];
	return version ? BigInt(version) : BigInt(0);
};

export const isEmptyDB = async (db: TXAsync): Promise<boolean> => {
	// Check if the database has any changes tracked (i.e., has it been used yet)
	// A freshly initialized database will have db_version = 0
	const version = await getDBVersion(db);
	return version === BigInt(0);
};
