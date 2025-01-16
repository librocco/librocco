import initWasm from "@vlcn.io/crsqlite-wasm";
import wasmUrl from "@vlcn.io/crsqlite-wasm/crsqlite.wasm?url";
import { cryb64 } from "@vlcn.io/ws-common";
import rxtbl from "@vlcn.io/rx-tbl";

import schema from "@librocco/shared/db-schemas/init.sql?raw";

import { type DB, type Change } from "./types";

export type DbCtx = { db: DB; rx: ReturnType<typeof rxtbl> };

const dbCache: Record<string, DbCtx> = {};

const schemaName = "init";
const schemaVersion = cryb64(schema);

async function getSchemaNameAndVersion(db: DB): Promise<[string, bigint] | null> {
	const nameRes = await db.execA<[string]>("SELECT value FROM crsql_master WHERE key = 'schema_name'");
	if (!nameRes?.length) return null;
	const [[name]] = nameRes;

	const versionRes = await db.execA<[string]>("SELECT value FROM crsql_master WHERE key = 'schema_version'");
	if (!versionRes?.length) throw new Error(`db has a schema name: ${name}, but no version`);
	const [[version]] = versionRes;

	return [name, BigInt(version)];
}

export async function getDB(dbname: string): Promise<DB> {
	const sqlite = await initWasm(() => wasmUrl);
	return sqlite.open(dbname);
}

export async function initializeDB(db: DB) {
	// Thought: This could probably be wrapped into a txn
	// not really: transactions are for DML, not for DDL
	// Apply the schema (initialise the db)
	await db.exec(schema);

	// Store schema info in crsql_master
	await db.exec("INSERT OR REPLACE INTO crsql_master (key, value) VALUES (?, ?)", ["schema_name", schemaName]);
	await db.exec("INSERT OR REPLACE INTO crsql_master (key, value) VALUES (?, ?)", ["schema_version", schemaVersion]);
}

export const getInitializedDB = async (dbname: string): Promise<DbCtx> => {
	if (dbCache[dbname]) {
		return dbCache[dbname];
	}

	const db = await getDB(dbname);

	const schemaRes = await getSchemaNameAndVersion(db);
	await initializeDB(db);

	// if (!schemaRes) {
	// } else {
	// 	// Check if schema name/version match
	// 	const [name, version] = schemaRes;
	// 	if (name !== schemaName || version !== schemaVersion) {
	// 		// TODO: We're throwing an error here on mismatch. Should probably be handled in a more delicate manner.
	// 		const msg = [
	// 			"DB name/schema mismatch:",
	// 			`  req name: ${schemaName}, got name: ${name}`,
	// 			`  req version: ${schemaVersion}, got version: ${version}`
	// 		].join("\n");
	// 		throw new Error(msg);
	// 	}
	// }

	const rx = rxtbl(db);
	dbCache[dbname] = { db, rx };

	return dbCache[dbname];
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
