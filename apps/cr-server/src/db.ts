import fs from "fs";
import path from "path";
import SQLite, { Database } from "better-sqlite3";
import { extensionPath } from "@vlcn.io/crsqlite";
import { cryb64 } from "@vlcn.io/ws-common";

const schemaCache: [string, bigint, string] | undefined = undefined

function getSchema(): [name: string, version: bigint, content: string] {
	if (schemaCache) return schemaCache

	const name = "orders"

	const fpath = path.resolve(process.cwd(), "src", "schemas", name)
	const content = fs.readFileSync(fpath, "utf8")

	const version = cryb64(content)

	return [name, version, content]
}

async function getSchemaNameAndVersion(db: Database): Promise<[string, bigint] | null> {
	const name = await db.prepare("SELECT value FROM crsql_master WHERE key = 'schema_name'").pluck().get() as string
	if (!name) return null;

	const version = await db.prepare("SELECT value FROM crsql_master WHERE key = 'schema_version'").pluck().safeIntegers().get() as bigint | undefined
	if (!version) throw new Error(`db has a schema name: ${name}, but no version`);

	return [name, BigInt(version)];
}

const dbCache = new Map<string, Database>()

/** Creates a bare minimum SQLite instance and adds CR-SQLite extension */
export function newDB(fpath: string) {
	const database = new SQLite(fpath, { verbose: console.log });
	database.loadExtension(extensionPath);
	return database;
}

export async function initializeDB(db: Database) {
	const [schemaName, schemaVersion, schema] = getSchema()

	// TODO: This could probably be wrapped into a txn
	//
	// Apply the schema (initialise the db)
	db.exec(schema);

	// Store schema info in crsql_master
	db.prepare("INSERT OR REPLACE INTO crsql_master (key, value) VALUES (?, ?)").run("schema_name", schemaName);
	db.prepare("INSERT OR REPLACE INTO crsql_master (key, value) VALUES (?, ?)").run("schema_version", schemaVersion);
}

export const getInitializedDB = async (fpath: string) => {
	// Check if db already cached
	if (dbCache.has(fpath)) return dbCache.get(fpath)!

	// Ensure the directory exists
	const dir = path.dirname(fpath);
	if (!fs.existsSync(dir)) {
		fs.mkdirSync(dir, { recursive: true });
	}

	const db = newDB(fpath);
	const [schemaName, schemaVersion] = getSchema()

	const schemaRes = await getSchemaNameAndVersion(db);
	if (!schemaRes) {
		await initializeDB(db);
		return db;
	}

	// Check if schema name/version match
	const [name, version] = schemaRes;
	if (name !== schemaName || version !== schemaVersion) {
		// TODO: We're throwing an error here on mismatch. Should probably be handled in a more delicate manner.
		const msg = [
			"DB name/schema mismatch:",
			`  req name: ${schemaName}, got name: ${name}`,
			`  req version: ${schemaVersion}, got version: ${version}`
		].join("\n");
		throw new Error(msg);
	}

	return db;
};
