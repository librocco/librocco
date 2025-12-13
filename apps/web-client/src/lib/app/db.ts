import { get, writable, type Readable, type Unsubscriber } from "svelte/store";
import { TblRx } from "@vlcn.io/rx-tbl";

import type { DbCtx } from "$lib/db/cr-sqlite/db";
import type { DBAsync, VFSWhitelist } from "$lib/db/cr-sqlite/core/types";

import type { App } from "./index";
import { ErrDbNotInit } from "./errors";
import { waitForStore } from "./utils";

// ---------------------------------- Structs ---------------------------------- //
export class AppDb implements DbCtx {
	db: DBAsync | null = null;
	// TODO: implement rx so that the subscription persists even if DB changes
	rx: TblRx | null = null;
	vfs: VFSWhitelist;

	// TODO: move init state here
	ready = writable(false);

	set(dbCtx: DbCtx) {
		this.db = dbCtx.db;
		this.rx = dbCtx.rx;
		this.vfs = dbCtx.vfs;
		this.ready.set(true);
	}
}

// ---------------------------------- Functions ---------------------------------- //
// TODO: merge the initDb with getInitializedDB logic
// TODO: support updating of DB
export async function initDb(app: App, dbCtx: DbCtx) {
	if (!dbCtx) throw new Error("[initDb] dbCtx is undefined");
	if (!dbCtx.db) throw new Error("[initDb] db is undefined");

	if (app.db.db) throw new Error("[initDb] db already initialised");

	app.db.set(dbCtx);
}

/**
 * Retrieve the DB in an async manner - this waits for DB initialisation, thus
 * ensuring we won't retrieve the DB before initialised
 * TODO: add check + error if no DB currently being initialised (nothing to await)
 */
export async function getDb(app: App): Promise<DBAsync> {
	await waitForStore(app.ready, ($ready) => $ready);
	return app.db.db;
}

/**
 * Instead of using `dbCtx.rx.(...)` subscriptions directly, we wrap them in this 'safety'
 * convenience function that throws if the DB is not initialised (ensuring the correct loading/initialisation order)
 */
export function getDbRx(app: App) {
	if (!get(app.db.ready)) {
		throw new ErrDbNotInit();
	}
	return app.db.rx;
}

// TODO: we probably want to move the vfs (string value) somewhere else
export function getVfs(app: App) {
	if (!get(app.db.ready)) {
		throw new ErrDbNotInit();
	}
	return app.db.vfs;
}
