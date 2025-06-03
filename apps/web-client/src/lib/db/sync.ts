import type WorkerInterface from "$lib/workers/WorkerInterface";
import { derived, writable } from "svelte/store";

export type SyncConfig = {
	dbid?: string;
	url?: string;
};

export type WorkerInterfaceSimplified = Pick<WorkerInterface, "startSync" | "stopSync">;

const newSyncInterface = () => {
	let worker: WorkerInterfaceSimplified;

	let dbid: string | undefined | null;
	let url: string | undefined | null;

	const init = (_worker: WorkerInterfaceSimplified) => {
		worker = _worker;
	};

	const sync = (config: SyncConfig) => {
		if (!worker) {
			console.warn("Trying to start sync without worker initialised: run '.init(worker)' first");
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
			return;
		}

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

export const newSyncProgressStore = () => {
	const startTimestamp = writable<number | null>(null);
	const isSyncing = derived(startTimestamp, ($startTimestamp) => !!$startTimestamp);

	let disposer: () => void;

	const start = (wkr: WorkerInterface) => {
		const disposer1 = wkr.onChangesReceived(({ timestamp }) => startTimestamp.set(timestamp));
		const disposer2 = wkr.onChangesProcessed(({ timestamp }) => startTimestamp.update(($ts) => ($ts === timestamp ? null : $ts)));
		disposer = () => (disposer1(), disposer2());
	};

	const stop = () => {
		disposer?.();
	};

	return { start, stop, isSyncing };
};
