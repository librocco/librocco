import { cryb64 } from "@vlcn.io/ws-common";

import schemaContent from "$lib/schemas/init?raw";
export { schemaContent };

import type { DBAsync, TXAsync, Change, VFSWhitelist } from "./types";

import { getMainThreadDB, getWorkerDB } from "./core";
import { DEFAULT_VFS } from "./core/constants";

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
