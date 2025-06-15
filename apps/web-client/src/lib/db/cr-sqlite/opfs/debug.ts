// The sqlite-wasm host code factory - we need to use the appropriate one with
// respect to the OPFS adapter we're using
import SQLiteAsyncESMFactory from "wa-sqlite/dist/wa-sqlite-async.mjs";
// import SQLiteESMFactory from "wa-sqlite/dist/wa-sqlite-async.mjs";

import { OPFSAnyContextVFS } from "wa-sqlite/src/examples/OPFSAnyContextVFS.js";
import * as SQLite from "wa-sqlite/src/sqlite-api.js";

/**
 * A TEMP function, to be run from the console, here to reduce the repetitive
 * steps when debugging / testing out
 */
export const setupOPFSDebug = async () => {
	// const wasm = await SQLiteESMFactory({
	const wasm = await SQLiteAsyncESMFactory({
		// NOTE: the wasm binary is served from the /static folder
		// for simplicity around Svelte-kit server setup
		//
		// This is not an ideally integrated solution (ideally, we would serve the build from the dist of the wa-sqlite submodule)
		locateFile() {
			const base = `http://${window.location.host}/preview/`;
			const url = new URL("wa-sqlite-async.wasm", base).href;
			return url;
		}
	});

	const sqlite3 = SQLite.Factory(wasm);
	const vfs = await OPFSAnyContextVFS.create("opfs", wasm);
	sqlite3.vfs_register(vfs, true);

	// We would nornally use just the sqlite3 object, but the adapter is there
	// as well just in case (I've used it in some previous steps, can't remember exactly)
	window["opfs"] = vfs;
	window["sqlite3"] = sqlite3;

	window["dir"] = await window.navigator.storage.getDirectory();
};
