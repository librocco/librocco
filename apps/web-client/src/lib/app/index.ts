import { get, derived } from "svelte/store";

import { AppDb, AppDbState, initializeDb } from "./db";
import { AppSync, startSync, stopSync } from "./sync";
import { AppConfig } from "./config";

import { IS_DEMO } from "$lib/constants";
import { clearIDBBatchAtomic, deleteDBFromOPFS } from "$lib/db/cr-sqlite/core/utils";
import type { VFSWhitelist } from "$lib/db/cr-sqlite/core";
import { vfsSupportsOPFS } from "$lib/db/cr-sqlite/core/vfs";

export class App {
	db = new AppDb();
	sync = new AppSync();
	config = IS_DEMO ? AppConfig.demo() : AppConfig.persisted();

	ready = derived([this.db.ready], ([$dbReady]) => $dbReady);
}

export const app = new App();

export async function nukeAndResyncDb(app: App, dbid: string, vfs: VFSWhitelist) {
	// 1. Set loading state -- effectively blocking any (basic) DB interaction until done
	app.db.setState(dbid, AppDbState.Loading);
	// 2. Stop sync (effectively closing the sync-worker -> DB connection)
	await stopSync(app);
	// 3. Close the current connection
	await app.db.db.close();

	// 4. Delete the DB file (this should be safe now -- no open connections)
	if (vfsSupportsOPFS(vfs)) {
		await deleteDBFromOPFS(dbid);
	} else {
		// NOTE: this removes all of the 'idb-batch-atomic' entries (potentially mutliple DBs)
		await clearIDBBatchAtomic();
	}

	// 5. Reinitialise the (clean) DB with provided DBID
	// NOTE: this sets the DB state to "ready" -- thus unlocking the DB for high-level usage
	// NOTE: this (upon success) invalidates the DB -- notifying any and all subscribers for DB invalidation
	await initializeDb(app, dbid, vfs);
	// 6. Start the sync (and persist syncActive = true)
	// NOTE: handling only happy path when sync available and URL set,
	// TODO: consider failure scenarios
	await startSync(app, dbid, get(app.config.syncUrl));
	app.config.syncActive.set(true);
}
