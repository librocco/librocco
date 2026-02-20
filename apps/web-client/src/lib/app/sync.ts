import { get, writable, type Writable, type Readable } from "svelte/store";
import { Mutex } from "async-mutex";

import type { ProgressState } from "$lib/types";

import WorkerInterface from "$lib/workers/WorkerInterface";

import { isSyncWorkerBridge, type DBAsync } from "$lib/db/cr-sqlite/core";
import { deleteDBFromOPFS, fetchAndStoreDBFile, wrapFileHandle } from "$lib/db/cr-sqlite/core/utils";

import type { App } from "./index";
import { ErrInvalidSyncURL } from "./errors";
import { waitForStore } from "./utils";
import { getDb, getVfs } from "./db";
import { isEmptyDB } from "$lib/db/cr-sqlite/db";
import { vfsSupportsOPFS } from "$lib/db/cr-sqlite/core/vfs";
import { browser } from "$app/environment";
import { updateSyncConnectivityMonitor } from "$lib/stores";
import { checkSyncCompatibility, markCompatibilityChecking } from "$lib/stores/sync-compatibility";

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
	destroy(): Promise<void>;
}

interface IAppSyncExclusive extends IAppSyncCore {
	worker: WorkerInterface;

	state: Writable<AppSyncState>;

	syncProgressStore: Writable<ProgressState>;
	initialSyncProgressStore: Writable<ProgressState>;

	active: boolean;
	addDisposer(dispose: () => void): void;
	bindDb(db: DBAsync): boolean;
	start(dbid: string, url: string): Promise<void>;
	stop(): Promise<void>;
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
	#disposers: Array<() => void> = [];

	initialSyncProgressStore = writable<ProgressState>({ active: false, nTotal: 0, nProcessed: 0 });

	constructor(worker?: WorkerInterface) {
		this.worker = worker || new WorkerInterface();
		this.#disposers.push(this.worker.onProgress(($progress) => this.syncProgressStore.set($progress)));
	}

	addDisposer(dispose: () => void) {
		this.#disposers.push(dispose);
	}

	bindDb(db: DBAsync): boolean {
		const supported = isSyncWorkerBridge(db);
		this.worker.bind(supported ? db : null);
		return supported;
	}

	// TODO: listen to DB invalidations and reset the sync (if active) when DB invalidated
	async start(dbid: string, url: string) {
		const cfg = this.#activeConfig;

		// NOOP -- nothing to do here
		if (cfg && cfg.dbid == dbid && cfg.url == url) return;

		// Stop sync if active with different setup (noop otherwise)
		await this.stop();

		await this.worker.startSync(dbid, { url, room: dbid });
		this.#activeConfig = { dbid, url };
	}

	async stop() {
		if (!this.active) return;
		await this.worker.stopSync(this.#activeConfig.dbid);
		this.#activeConfig = null;
	}

	async destroy() {
		await this.stop();
		for (const dispose of this.#disposers) dispose();
		this.#disposers = [];
		await this.worker.destroy();
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
		return this.runExclusive(() => this.core.destroy());
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
export async function initializeSync(app: App) {
	return app.sync.runExclusive(async (sync) => {
		// If already initialised, just ensure we're bound to the latest DB.
		if (get(sync.state) >= AppSyncState.Initializing) {
			const db = await getDb(app);
			sync.bindDb(db);
			return;
		}

		// Initialise the worker
		sync.state.set(AppSyncState.Initializing);
		const db = await getDb(app);
		sync.bindDb(db);
		updateSyncConnectivityMonitor(sync.worker);

		// Subscribe to sync changes to notify UI subscribers (debounced to avoid UI thrashing)
		let debounceTimer: ReturnType<typeof setTimeout> | null = null;
		const disposeChangesListener = sync.worker.onChangesReceived(() => {
			if (debounceTimer) clearTimeout(debounceTimer);
			debounceTimer = setTimeout(() => {
				app.db.rx.notifyAll();
				debounceTimer = null;
			}, 100);
		});
		sync.addDisposer(disposeChangesListener);

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
	return app.sync.runExclusive(async (sync) => {
		if (!sync.bindDb(db)) {
			console.warn("[sync] Current DB backend does not support integrated sync runtime; skipping sync start");
			return;
		}

		// If sync is active:
		// - no need to start (idempotency)
		// - it's safe to assume the initial sync was already attempted
		if (sync.active) return;

		// ---------------------------------- 1. Initial Sync ---------------------------------- //
		const isEmpty = await isEmptyDB(db);
		const opfsSupported = vfsSupportsOPFS(getVfs(app));
		const initialSyncReloadGuardKey = `librocco-initial-sync-reload:${dbid}`;
		const shouldRunInitialSync = isEmpty && opfsSupported && (!browser || window.sessionStorage.getItem(initialSyncReloadGuardKey) !== "1");

		if (!isEmpty && browser) {
			// DB is no longer empty; clear any stale guard from previous initial-sync reload attempt.
			window.sessionStorage.removeItem(initialSyncReloadGuardKey);
		}

		if (shouldRunInitialSync) {
			sync.state.set(AppSyncState.InitialSync);
			let shouldReload = false;
			try {
				const fileUrl = getRemoteDbFileUrl(url, dbid);
				await _performInitialSync(dbid, fileUrl, sync.initialSyncProgressStore, async () => {
					// Close the DB before replacing the OPFS file; reload after swap to reopen safely.
					shouldReload = true;
					await db.close();
				});
			} catch (err) {
				console.error("Initial sync failed:", err);
			} finally {
				sync.state.set(AppSyncState.Idle);
			}

			if (shouldReload && browser) {
				// Guard against repeated reload loops (e.g. remote DB is also empty).
				window.sessionStorage.setItem(initialSyncReloadGuardKey, "1");
				// Re-initialize the app against the swapped-in DB file.
				window.location.reload();
				return;
			}
		}

		// ---------------------------------- 2. Live Sync ---------------------------------- //
		markCompatibilityChecking();
		await sync.start(dbid, url);

		// Once sync is running, re-run compatibility check to capture remote metadata that may have been missing on first pass
		checkSyncCompatibility({ dbid, syncUrl: url, mode: "background" }).catch((err) =>
			console.warn("Post-start compatibility check failed", err)
		);
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
	return app.sync.runExclusive((sync) => sync.stop());
}
