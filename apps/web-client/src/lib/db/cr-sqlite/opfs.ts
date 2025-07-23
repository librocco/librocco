import { SQLite3 } from "@vlcn.io/crsqlite-wasm";
import * as SQLite from "@vlcn.io/wa-sqlite";

import SQLiteAsyncESMFactory from "@vlcn.io/crsqlite-wasm/crsqlite.mjs";
import { OPFSAnyContextVFS } from "@vlcn.io/wa-sqlite/src/examples/OPFSAnyContextVFS.js";

let api: SQLite3 | null = null;

export async function initWasm(locateWasm?: (file: string) => string): Promise<SQLite3> {
	if (api != null) {
		return api;
	}

	const wasmModule = await SQLiteAsyncESMFactory({
		locateFile(file: string) {
			if (locateWasm) {
				return locateWasm(file);
			}
			return new URL("crsqlite.wasm", import.meta.url).href;
		}
	});
	const sqlite3 = SQLite.Factory(wasmModule);
	const vfs = await OPFSAnyContextVFS.create("opfs-any-context-vfs", wasmModule);
	sqlite3.vfs_register(vfs, true);

	api = new SQLite3(sqlite3);
	return api;
}
