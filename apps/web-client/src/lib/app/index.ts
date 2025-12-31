import { get, derived } from "svelte/store";

import { AppDb, AppDbState, initializeDb } from "./db";
import { AppSync, startSync, stopSync } from "./sync";
import { AppConfig } from "./config";

import { IS_DEMO } from "$lib/constants";
import { clearIDBBatchAtomic, deleteDBFromOPFS } from "$lib/db/cr-sqlite/core/utils";
import type { VFSWhitelist } from "$lib/db/cr-sqlite/core";
import { vfsSupportsOPFS } from "$lib/db/cr-sqlite/core/vfs";

export class App {
	// TODO: maybe implement App state -- currently we're relying on both:
	// - db state - as app state
	// - db error - as app error
	// Both are good enough considering the current flow, but would be good to
	// make the state global.
	get state() {
		return this.db.state;
	}

	db = new AppDb();
	sync = new AppSync();
	config = IS_DEMO ? AppConfig.demo() : AppConfig.persisted();

	ready = derived([this.db.ready], ([$dbReady]) => $dbReady);
}

export const app = new App();

export async function nukeAndResyncDb(app: App, dbid: string, vfs: VFSWhitelist) {
	// Set loading state -- effectively blocking any (basic) DB interaction until done
	app.db.setState(dbid, AppDbState.Loading);
	// Stop sync (effectively closing the sync-worker -> DB connection)
	await stopSync(app);
	// Close the current connection
	await app.db.db.close();

	// Delete the DB file (this should be safe now -- no open connections)
	if (vfsSupportsOPFS(vfs)) {
		await deleteDBFromOPFS(dbid);
	} else {
		// NOTE: this removes all of the 'idb-batch-atomic' entries (potentially mutliple DBs)
		await clearIDBBatchAtomic();
	}

	// Reinitialise the (clean) DB with provided DBID
	// NOTE: this sets the DB state to "ready" -- thus unlocking the DB for high-level usage
	// NOTE: this (upon success) invalidates the DB -- notifying any and all subscribers for DB invalidation
	await initializeDb(app, dbid, vfs);
	// Start the sync (and persist syncActive = true)
	// NOTE: handling only happy path when sync available and URL set,
	// TODO: consider failure scenarios
	await startSync(app, dbid, get(app.config.syncUrl));
	app.config.syncActive.set(true);
}

export async function selectDb(app: App, dbid: string, vfs: VFSWhitelist) {
	// Set loading state -- effectively blocking any (basic) DB interaction until done
	app.db.setState(dbid, AppDbState.Loading);
	// Stop sync (effectively closing the sync-worker -> DB connection)
	await stopSync(app);
	// Close the current connection
	await app.db.db.close();

	// Reinitialise the (clean) DB with provided DBID
	// NOTE: this sets the DB state to "ready" -- thus unlocking the DB for high-level usage
	// NOTE: this (upon success) invalidates the DB -- notifying any and all subscribers for DB invalidation
	await initializeDb(app, dbid, vfs);

	// Start sync if it was on before the switch
	if (get(app.config.syncActive)) {
		await startSync(app, dbid, get(app.config.syncUrl));
	}
}

export async function deleteCurrentDb(app: App, next: { dbid: string; vfs: VFSWhitelist }) {
	const { dbid, vfs } = app.db;

	// Set loading state -- effectively blocking any (basic) DB interaction until done
	app.db.setState(dbid, AppDbState.Loading);
	// Stop sync (effectively closing the sync-worker -> DB connection)
	await stopSync(app);
	// Close the current connection
	await app.db.db.close();

	// Delete the DB file (this should be safe now -- no open connections)
	if (vfsSupportsOPFS(vfs)) {
		await deleteDBFromOPFS(dbid);
	} else {
		// NOTE: this removes all of the 'idb-batch-atomic' entries (potentially mutliple DBs)
		await clearIDBBatchAtomic();
	}

	// Reinitialise the (clean) DB with provided DBID
	// NOTE: this sets the DB state to "ready" -- thus unlocking the DB for high-level usage
	// NOTE: this (upon success) invalidates the DB -- notifying any and all subscribers for DB invalidation
	await initializeDb(app, next.dbid, next.vfs);

	// Start sync if it was on before the switch
	if (get(app.config.syncActive)) {
		await startSync(app, dbid, get(app.config.syncUrl));
	}
}
