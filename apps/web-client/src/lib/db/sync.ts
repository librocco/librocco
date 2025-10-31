import { type Writable, writable } from "svelte/store";

import type { ProgressState } from "$lib/types";

import type WorkerInterface from "$lib/workers/WorkerInterface";
import type { VFSWhitelist } from "./cr-sqlite/core";
import { dbCache, getDB, isEmptyDB } from "./cr-sqlite/db";

import { vfsSupportsOPFS } from "./cr-sqlite/core/vfs";
import { deleteDBFromOPFS, fetchAndStoreDBFile, wrapFileHandle } from "./cr-sqlite/core/utils";

export type SyncConfig = {
	dbid?: string;
	url?: string;
	vfs?: VFSWhitelist;
};

export type WorkerInterfaceSimplified = Pick<WorkerInterface, "startSync" | "stopSync" | "vfs">;

class InitialSyncOptimiser {
	inProgress = new Map<string, Promise<void>>();

	constructor() {}

	private async _fetch(url: string, dbid: string, progressStore: Writable<ProgressState>) {
		// Download the remote DB into OPFS
		//
		// Fetch the file to temp location
		const dbFname = dbid;
		const tempFname = dbFname + "-temp";

		try {
			await fetchAndStoreDBFile(url, tempFname, progressStore);
		} catch (err) {
			// NOTE: fetchAndStoreDBFile performs the cleanup, just log the error and abort
			const msg = [
				"Error fetching and storing remote DB file for sync optimisation:",
				(err as Error).message,
				"The sync will still be attempted without initial optimisation"
			].join("\n");
			console.error(msg);
			return;
		}

		// Upon successful download: close the existing DB, clean up state and move the file into place
		//
		// NOTE: using a dummy store here as we guarantee that sync is not active at this point (see stop() above)
		try {
			await deleteDBFromOPFS({ dbname: dbid, dbCache, syncActiveStore: writable(false) });

			// Replace existing DB file with the downloaded one
			const rootDir = await window.navigator.storage.getDirectory();
			const tempFileHandle = await rootDir.getFileHandle(tempFname);
			await wrapFileHandle(rootDir, tempFileHandle).move(dbFname);
		} catch (err) {
			// Log the error out -- this shouldn't happen and is unexpected,
			// so we want the full error without
			console.error(err);
			return;
		}
	}

	async fetch(url: string, dbid: string, progressStore = writable<ProgressState>()) {
		const existingOptimisation = this.inProgress.get(dbid);
		if (existingOptimisation) {
			return existingOptimisation;
		}

		const promise = this._fetch(url, dbid, progressStore);
		this.inProgress.set(dbid, promise);

		await promise;
		this.inProgress.delete(dbid);
	}
}

const newSyncInterface = () => {
	const optimiser = new InitialSyncOptimiser();

	let worker: WorkerInterfaceSimplified;

	let dbid: string | undefined | null;
	let url: string | undefined | null;

	const init = (_worker: WorkerInterfaceSimplified) => {
		worker = _worker;
	};

	type SyncOpts = {
		/** Passing 'invalidateAll' as an argument to avoid direct imports from $app/navigation for stability in tests */
		invalidateAll?: () => Promise<void>;
		/** Turn off initial fetch optimisation (usually only used for testing) */
		optimiseFetch?: boolean;
	};
	const sync = async (config: SyncConfig, { invalidateAll, optimiseFetch = true }: SyncOpts = {}) => {
		console.log("sync started");
		if (!worker) {
			console.warn("Trying to start sync without worker initialised: run '.init(worker)' first");
			return;
		}

		const vfs = worker.vfs();
		if (!vfs) {
			console.warn("Worker not initialised, missing VFS");
			return;
		}

		// Idempotency: NOOP
		if (config.dbid === dbid && config.url === url) {
			return;
		}

		// If we made it here, the new config is different than the current one
		// Stop the sync (regardless of config being valid -- starting new sync or stopping due to missing values)
		stop();

		// Can't start a new sync without a valid config
		if (!config.dbid || !config.url) {
			console.warn("Trying to start sync without valid config: ", config);
			return;
		}

		// Check if optimisation available (VFS is OPFS)
		if (vfsSupportsOPFS(vfs) && optimiseFetch) {
			// Openning a new DB connection to check if empty.
			// If DB (for some reason doesn't exist) a new one will be created (and behave as empty)
			const dbEmpty = await (async () => {
				const db = await getDB(config.dbid);
				const res = await isEmptyDB(db);
				await db.close();
				return res;
			})();

			if (dbEmpty) {
				const fileUrl = new URL(config.url);
				fileUrl.protocol = "http";
				fileUrl.pathname = `/${config.dbid}/file`;
				console.time("fetch");
				await optimiser.fetch(fileUrl.href, config.dbid, syncProgressStore.progress);
				console.timeEnd("fetch");
				// Invalidate all to trigger reload of the DB (this works if err as well)
				await invalidateAll?.();
			}
		}

		// NOTE: the following runs regardless of optimisation being successful (or available for that matter)

		// Start the new sync
		dbid = config.dbid;
		url = config.url;

		worker.startSync(dbid, { url, room: dbid });
	};

	const stop = () => {
		if (!dbid) {
			return;
		}

		worker.stopSync(dbid);

		dbid = undefined;
		url = undefined;
	};

	// NOTE: This will mostly be used between tests, as of now, I don't see a use case for this in the app
	const reset = () => {
		stop();
		worker = undefined;
		dbid = undefined;
		url = undefined;
	};

	const debug = () => {
		console.log({ worker, dbid, url });
	};

	return { init, sync, stop, reset, debug, worker: () => worker };
};

export const sync = newSyncInterface();

const newSyncProgressStore = () => {
	const progress = writable<ProgressState>({ active: false, nProcessed: 0, nTotal: 0 });

	let disposer: () => void;

	const start = (wkr: WorkerInterface) => {
		disposer = wkr.onProgress(($progress) => progress.set($progress));
	};

	const stop = () => {
		disposer?.();
	};

	return { start, stop, progress };
};
export const syncProgressStore = newSyncProgressStore();
