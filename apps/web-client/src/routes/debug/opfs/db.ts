// The sqlite-wasm host code factory - we need to use the appropriate one with
// respect to the OPFS adapter we're using
import { zip } from "@librocco/shared";
import SQLiteAsyncESMFactory from "wa-sqlite/dist/wa-sqlite-async.mjs";
// import SQLiteESMFactory from "wa-sqlite/dist/wa-sqlite-async.mjs";

import { OPFSAnyContextVFS } from "wa-sqlite/src/examples/OPFSAnyContextVFS.js";
import { OPFSCoopSyncVFS } from "wa-sqlite/src/examples/OPFSCoopSyncVFS.js";

import * as SQLite from "wa-sqlite/src/sqlite-api.js";
import * as SQLiteConst from "wa-sqlite/src/sqlite-constants.js";

const vfsLookup = {
	"opfs-any-context": OPFSAnyContextVFS,
	"opfs-coop-sync": OPFSCoopSyncVFS
};

export type VFSKind = keyof typeof vfsLookup;

/**
 * Initialises the DB with the requested VFS
 * @param dbid - interchangable with db name, no extension needed (`.sqlite3` will be appended for the file name)
 * @param kind - one of the two supported VFS adapters:
 * - "opfs-any-context" - this works in any context (even concurrent access)
 * - "opfs-coop-sync" - this won't work in the main thread (only worker), but has not been tested (since the former works out-of-the-box)
 * @param locateFile - see the calling code, something like `() => wasmUrl`
 */
export async function initDB(dbid: string, kind: string, locateFile?: () => string): Promise<SQLiteWrapped> {
	const wasm = await SQLiteAsyncESMFactory({
		// NOTE: the wasm binary is served from the /static folder
		// for simplicity around Svelte-kit server setup
		//
		// This is not an ideally integrated solution (ideally, we would serve the build from the dist of the wa-sqlite submodule)
		locateFile() {
			return locateFile();
		}
	});

	const sqlite3 = SQLite.Factory(wasm) as SQLiteAPI;

	// sqlite3["str_new"] = wasm["_sqlite3_str_new"];
	// sqlite3["str_value"] = wasm["_sqlite3_str_value"];
	// sqlite3["str_finish"] = wasm["_sqlite3_str_finish"];
	// sqlite3["prepare_v2"] = wasm["_sqlite3_prepare_v2"];

	const vfs = await vfsLookup[kind].create(kind, wasm);

	sqlite3.vfs_register(vfs, true);

	const fname = [dbid, ".sqlite3"].join("");

	const db = await sqlite3.open_v2(fname, SQLiteConst.SQLITE_OPEN_READWRITE | SQLiteConst.SQLITE_OPEN_CREATE, kind);

	// Register the WASM api and the SQLite wrapper to the window for debug purposes
	// window["vfs"] = vfs;
	// window["wasm"] = wasm;
	// window["sqlite3"] = sqlite3;

	return new SQLiteWrapped(sqlite3, db);
}

export class SQLiteWrapped {
	api: SQLiteAPI;
	db: number; // I'm not sure why this is a number (probably a file descriptor, as it's returned from api.open_v2(...))

	constructor(api: SQLiteAPI, db: number) {
		this.api = api;
		this.db = db;
	}

	/**
	 * A very simple implementation of `db.exec` like the one we get with crsql-wasm
	 * NOTE: this implementation doesn't accept the `bind` parameter - this is WIP for the future
	 * NOTE: the original also uses mutexes (and is run within a transaction) -- we're not doing that here (for sake of simplicity),
	 * so you need to be sure no requests are run concurrently as that could introduce deadlocks in the SQLite
	 */
	exec<R extends any[]>(sql: string): Promise<R[]> {
		return this._exec(sql, false) as Promise<R[]>;
	}

	/**
	 * A very simple implementation of `db.execA` like the one we get with crsql-wasm
	 * NOTE: this implementation doesn't accept the `bind` parameter - this is WIP for the future
	 * NOTE: the original also uses mutexes (and is run within a transaction) -- we're not doing that here (for sake of simplicity),
	 * so you need to be sure no requests are run concurrently as that could introduce deadlocks in the SQLite
	 */
	execA<R extends any[]>(sql: string): Promise<R[]> {
		return this._exec(sql, false) as Promise<R[]>;
	}

	/**
	 * A very simple implementation of `db.execO` like the one we get with crsql-wasm
	 * NOTE: this implementation doesn't accept the `bind` parameter - this is WIP for the future
	 * NOTE: the original also uses mutexes (and is run within a transaction) -- we're not doing that here (for sake of simplicity),
	 * so you need to be sure no requests are run concurrently as that could introduce deadlocks in the SQLite
	 */
	execO<R extends Record<string, any>>(sql: string): Promise<R[]> {
		return this._exec(sql, true) as Promise<R[]>;
	}

	private async _exec(sql: string, retObj: boolean) {
		let columns: string[];
		let rows: any[][] = [];

		const rc = await this.api.exec(this.db, sql, (row: any[], cols: string[]) => {
			columns = columns ?? cols;
			rows.push(row);
		});

		if (rc !== SQLite.SQLITE_OK) {
			throw new Error(`SQLite error: ${rc}`);
		}

		if (!retObj) {
			return rows;
		}

		return rows.map((row) => Object.fromEntries(zip(columns, row)));
	}
}
