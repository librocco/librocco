import { get, writable, type Writable, type Readable } from "svelte/store";
import { Mutex } from "async-mutex";

import type { ProgressState } from "$lib/types";

import SyncWorker from "$lib/workers/sync-worker.ts?worker";
import WorkerInterface from "$lib/workers/WorkerInterface";

import type { VFSWhitelist } from "$lib/db/cr-sqlite/core";
import { deleteDBFromOPFS, fetchAndStoreDBFile, wrapFileHandle } from "$lib/db/cr-sqlite/core/utils";

import type { App } from "./index";
import { ErrInvalidSyncURL } from "./errors";
import { waitForStore } from "./utils";
import { getDb, getVfs } from "./db";
import { isEmptyDB } from "$lib/db/cr-sqlite/db";
import { vfsSupportsOPFS } from "$lib/db/cr-sqlite/core/vfs";
import { browser } from "$app/environment";
import { updateSyncConnectivityMonitor } from "$lib/stores";

// ---------------------------------- Structs ---------------------------------- //
export enum AppSyncState {
	Destroyed, // TODO: implement destroyed behaviour
	Null,
	Initializing,
	Idle,
	InitialSync,
	Syncing
}

interface IAppSyncCore {
	destroy(): void;
}

interface IAppSyncExclusive extends IAppSyncCore {
	worker: WorkerInterface;

	state: Writable<AppSyncState>;

	syncProgressStore: Writable<ProgressState>;
	initialSyncProgressStore: Writable<ProgressState>;

	active: boolean;
	start(dbid: string, url: string): void;
	stop(): void;
}

export interface IAppSync {
	state: Readable<AppSyncState>;

	syncProgressStore: Readable<ProgressState>;
	initialSyncProgressStore: Readable<ProgressState>;

	runExclusive<T>(cb: (x: IAppSyncExclusive) => T | Promise<T>): Promise<T>;
}

export type SyncActiveConfig = {
	dbid: string;
	url: string;
};

class AppSyncCore implements IAppSyncExclusive {
	worker: WorkerInterface;

	state = writable<AppSyncState>();

	#activeConfig: SyncActiveConfig | null = null;
	// If no dbid set - this worker is currently not active
	get active() {
		return Boolean(this.#activeConfig);
	}

	syncProgressStore = writable<ProgressState>({ active: false, nTotal: 0, nProcessed: 0 });
	#syncProgressDisposer: () => void;

	initialSyncProgressStore = writable<ProgressState>({ active: false, nTotal: 0, nProcessed: 0 });

	constructor(worker?: WorkerInterface) {
		// Worker is only accessible from browser
		// TODO: This is a quick fix -- handle this in a nicer way
		if (browser) {
			this.worker = worker || new WorkerInterface(new SyncWorker());
			this.#syncProgressDisposer = this.worker.onProgress(($progress) => this.syncProgressStore.set($progress));
		}
	}

	// TODO: listen to DB invalidations and reset the sync (if active) when DB invalidated
	start(dbid: string, url: string) {
		const cfg = this.#activeConfig;

		// NOOP -- nothing to do here
		if (cfg && cfg.dbid == dbid && cfg.url == url) return;

		// Stop sync if active with different setup (noop otherwise)
		this.stop();

		this.worker.startSync(dbid, { url, room: dbid });
		this.#activeConfig = { dbid, url };
	}

	stop() {
		if (!this.active) return;
		this.worker.stopSync(this.#activeConfig.dbid);
		this.#activeConfig = null;
	}

	destroy() {
		this.stop();
		this.#syncProgressDisposer?.();
	}
}

export class AppSync implements IAppSync {
	#mutex = new Mutex();

	// NOTE: In most use cases, an empty constructor call is file,
	// we're allowing for dependency injection here mostly for testing purposes
	constructor(private readonly core = new AppSyncCore()) {}

	get state() {
		return this.core.state as Readable<AppSyncState>;
	}

	get syncProgressStore() {
		return this.core.syncProgressStore as Readable<ProgressState>;
	}

	get initialSyncProgressStore() {
		return this.core.initialSyncProgressStore as Readable<ProgressState>;
	}

	destroy() {
		this.runExclusive(() => {
			this.core.destroy();
		});
	}

	/**
	 * A wrapper used to run the callback with exclusive access. It accepts a
	 * callback and passes an internal sync object.
	 *
	 * NOTE: This works even if sync not initialised
	 */
	runExclusive<T>(cb: (sync: IAppSyncExclusive) => T | Promise<T>): Promise<T> {
		return this.#mutex.runExclusive(() => cb(this.core));
	}
}

// ---------------------------------- Functions ---------------------------------- //
export async function initializeSync(app: App, vfs: VFSWhitelist) {
	return app.sync.runExclusive(async (sync) => {
		// noop if already initialised
		if (get(sync.state) >= AppSyncState.Initializing) return;

		// Initialise the worker
		sync.state.set(AppSyncState.Initializing);
		sync.worker.start(vfs);
		updateSyncConnectivityMonitor(sync.worker);

		// Wait for the worker to be initialised
		await sync.worker.initPromise;
		sync.state.set(AppSyncState.Idle);
	});
}

export async function startSync(app: App, dbid: string, url: string) {
	// ---------------------------------- 0. Checks ---------------------------------- //
	//
	// TODO: perhaps implement a more robust URL validation
	if (!url) {
		throw new ErrInvalidSyncURL(url);
	}

	// Ensure DB is initialised -- none of this makes sense otherwise
	const db = await getDb(app);

	// Ensure sync is ready
	await waitForStore(app.sync.state, ($s) => $s > AppSyncState.Initializing);

	// TODO: this should also be run exclusively with respect to the DB
	app.sync.runExclusive(async (sync) => {
		// If sync is active:
		// - no need to start (idempotency)
		// - it's safe to assume the initial sync was already attempted
		if (sync.active) return;

		// ---------------------------------- 1. Initial Sync ---------------------------------- //
		const isEmpty = await isEmptyDB(db);
		const opfsSupported = vfsSupportsOPFS(getVfs(app));

		if (isEmpty && opfsSupported) {
			sync.state.set(AppSyncState.InitialSync);
			let shouldReload = false;
			try {
				const fileUrl = getRemoteDbFileUrl(url, dbid);
				await _performInitialSync(dbid, fileUrl, sync.initialSyncProgressStore, async () => {
					// Close the DB before replacing the OPFS file; reload after swap to reopen safely.
					shouldReload = true;
					await db.close();
				});
			} catch {
				// Probably console log here
			} finally {
				sync.state.set(AppSyncState.Idle);
			}

			if (shouldReload && browser) {
				// Re-initialize the app against the swapped-in DB file.
				window.location.reload();
				return;
			}
		}

		// ---------------------------------- 2. Live Sync ---------------------------------- //
		sync.start(dbid, url);
	});
}

/**
 *
 */
export async function _performInitialSync(
	dbid: string,
	remoteUrl: string,
	progressStore: Writable<ProgressState>,
	beforeReplace?: () => Promise<void>
): Promise<boolean> {
	// Download the remote DB into OPFS
	//
	// Fetch the file to temp location
	const dbFname = dbid;
	const tempFname = dbFname + "-temp";

	try {
		await fetchAndStoreDBFile(remoteUrl, tempFname, progressStore);
	} catch (err) {
		// NOTE: fetchAndStoreDBFile performs the cleanup, just log the error and abort
		const msg = [
			"Error fetching and storing remote DB file for sync optimisation:",
			(err as Error).message,
			"The sync will still be attempted without initial optimisation"
		].join("\n");
		console.error(msg);
		return false;
	}

	const cleanupTempFile = async () => {
		try {
			await deleteDBFromOPFS(tempFname);
		} catch (err) {
			console.error(err);
		}
	};

	if (beforeReplace) {
		try {
			await beforeReplace();
		} catch (err) {
			console.error(err);
			await cleanupTempFile();
			return false;
		}
	}

	try {
		await deleteDBFromOPFS(dbFname);

		// Replace existing DB file with the downloaded one
		const rootDir = await window.navigator.storage.getDirectory();
		const tempFileHandle = await rootDir.getFileHandle(tempFname);
		await wrapFileHandle(rootDir, tempFileHandle).move(dbFname);
	} catch (err) {
		// Log the error out -- this shouldn't happen and is unexpected,
		// so we want the full error without
		console.error(err);
		await cleanupTempFile();
		return false;
	}

	return true;
}

function getRemoteDbFileUrl(syncUrl: string, dbid: string) {
	// Convert ws(s) to http(s) and point to the snapshot file endpoint.
	const url = new URL(syncUrl);
	if (url.protocol === "ws:") url.protocol = "http:";
	if (url.protocol === "wss:") url.protocol = "https:";
	url.pathname = `/${dbid}/file`;
	url.search = "";
	url.hash = "";
	return url.toString();
}

export async function stopSync(app: App) {
	app.sync.runExclusive((sync) => sync.stop());
}
