import { SQLite3 } from "@vlcn.io/crsqlite-wasm";
import * as SQLite from "wa-sqlite";

import SQLiteAsyncESMFactory from "wa-sqlite/dist/wa-sqlite-async.mjs";
import { OPFSAnyContextVFS } from "wa-sqlite/src/examples/OPFSAnyContextVFS.js";

let api: SQLite3 | null = null;

export default async function initWasm(locateWasm?: (file: string) => string): Promise<SQLite3> {
	if (api != null) {
		return api;
	}

	const wasmModule = await SQLiteAsyncESMFactory({
		locateFile(file: string) {
			if (locateWasm) {
				const fpath = locateWasm(file);
				return fpath;
			}
			return new URL("crsqlite.wasm", import.meta.url).href;
		}
	});

	const sqlite3 = SQLite.Factory(wasmModule);
	// window["sqlite3"] = sqlite3;

	// Register the provided VFS adapter and make it the default
	const vfs = await OPFSAnyContextVFS.create("opfs", wasmModule);
	// window["vfs"] = vfs;

	sqlite3.vfs_register(vfs, true);

	api = new SQLite3(sqlite3, "opfs");
	// window["api"] = api;

	return api;
}

export const locateFile = () => {
	const base = `http://${window.location.host}/preview/`;
	const url = new URL("wa-sqlite-async.wasm", base).href;
	return url;
};
