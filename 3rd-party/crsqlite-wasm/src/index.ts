import SQLiteAsyncESMFactory from "@vlcn.io/wa-sqlite/dist/crsqlite-sync.mjs";
import * as SQLite from "wa-sqlite";
// @ts-ignore
import { IDBBatchAtomicVFS } from "@vlcn.io/wa-sqlite/src/examples/IDBBatchAtomicVFS.js";
import { serialize, topLevelMutex } from "./serialize.js";
import { DB } from "./DB.js";
export { DB } from "./DB.js";

let api: SQLite3 | null = null;
type SQLiteAPI = ReturnType<typeof SQLite.Factory>;

export class SQLite3 {
	constructor(private base: SQLiteAPI, private vfs = "idb-batch-atomic") { }

	open(filename?: string, mode: string = "c") {
		const fname = filename || ":memory:";
		const flags = SQLite.SQLITE_OPEN_CREATE | SQLite.SQLITE_OPEN_READWRITE | SQLite.SQLITE_OPEN_URI;
		const vfs = filename != null ? this.vfs : undefined;

		console.log(`fname: ${fname}, mode: ${mode}, vfs: ${vfs}`);

		return serialize(
			null,
			undefined,
			() => this.base.open_v2(fname, flags, vfs),
			topLevelMutex
		).then((db: any) => {
			console.log("serialised (whatever)")
			const ret = new DB(this.base, db, fname);
			return ret
				.prepare(
					`SELECT tbl_name FROM tables_used(?) AS u
        JOIN sqlite_master ON sqlite_master.name = u.name
        WHERE u.schema = 'main'`
				)
				.then((stmt) => {
					stmt.raw(true);
					ret._setTablesUsedStmt(stmt);
				})
				.then(() => ret.execA("select quote(crsql_site_id());"))
				.then((siteid) => {
					ret._setSiteid(siteid[0][0].replace(/'|X/g, ""));
					return ret;
				});
		});
	}
}

export default async function initWasm(
	locateWasm?: (file: string) => string
): Promise<SQLite3> {
	if (api != null) {
		return api;
	}

	const wasmModule = await SQLiteAsyncESMFactory({
		locateFile(file: string) {
			if (locateWasm) {
				return locateWasm(file);
			}
			return new URL("crsqlite.wasm", import.meta.url).href;
		},
	});
	const sqlite3 = SQLite.Factory(wasmModule);
	// Register the provided VFS adapter and make it the default
	sqlite3.vfs_register(new IDBBatchAtomicVFS("idb-batch-atomic", { durability: "relaxed" }));

	api = new SQLite3(sqlite3);
	return api;
}
