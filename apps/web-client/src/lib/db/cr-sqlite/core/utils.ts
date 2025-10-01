import { type Writable, writable } from "svelte/store";

import type { DbCtx } from "$lib/db/cr-sqlite/db";
import type { ProgressState } from "$lib/types";

import { retry } from "$lib/utils/misc";

/**
 * Fetches the DB file (.sqlite3) from the provided URL and stores it in OPFS under the given target name.
 * NOTE: doesn't perform any checks if the DB is valid or not -- this shold be done outside the function.
 *
 * @param url The URL to fetch the DB file from.
 * @param target The target filename in OPFS (e.g., 'mydb.sqlite3').
 * @param progressStore Optional Svelte writable store to track progress. If not provided, a new one will be created.
 */
export async function fetchAndStoreDBFile(url: string, target: string, progressStore: Writable<ProgressState> = writable<ProgressState>()) {
	// OPFS
	const root = await navigator.storage.getDirectory();
	const fileHandle = await root.getFileHandle(target, { create: true });
	const writable = await fileHandle.createWritable();

	// Fetch
	const res = await fetch(url);
	if (!res.ok || !res.body) {
		throw new Error(`Failed to fetch ${url}: ${res.status} ${res.statusText}`);
	}

	const contentLength = parseInt(res.headers.get("Content-Length") || "0", 10);
	if (!contentLength) throw new Error("Content-Length header is missing or invalid");

	progressStore.set({ active: true, nProcessed: 0, nTotal: contentLength });
	let received = 0;

	// Initial write (from res stream to OPFS)
	const reader = res.body.getReader();
	// eslint-disable-next-line no-constant-condition
	while (true) {
		const { done, value } = await reader.read();
		if (done) break;

		await writable.write(value);
		received += value.length;

		progressStore.set({ active: true, nProcessed: received, nTotal: contentLength });
	}
	// Close the initial write
	await writable.close();

	// Check for locking mode (and disable WAL)
	const file = await fileHandle.getFile();
	const buf = await file.arrayBuffer();
	const view = new Uint8Array(buf, 0, Math.min(32, buf.byteLength));
	if (view.length < 20) throw new Error("File too small to be a valid SQLite DB.");
	const isWal = view[18] === 0x02 || view[19] === 0x02;

	// If is WAL mode, update the header to disable it (set to ROLLBACK mode)
	if (isWal) {
		const writable = await fileHandle.createWritable({ keepExistingData: true });
		// Make sure the file header says: no WAL (use rollback mode)
		await writable.write({ type: "write", position: 18, data: new Uint8Array([0x01]) });
		await writable.write({ type: "write", position: 19, data: new Uint8Array([0x01]) });

		await writable.close();
	}

	progressStore.set({ active: false, nProcessed: 0, nTotal: 0 });
}

type Params = {
	dbname: string;
	syncActiveStore: Writable<boolean>;
	dbCache: Map<string, Promise<DbCtx>>;
};
/**
 * A util used to delete the DB from OPFS:
 * - stops the sync (if active) - to ensure connections are closed on that front
 * - if DB cached (it was already used in this session), does db.close() (releasing the connection)
 * - deletes the DB from cache
 * - deletes the DB file (and its -wal and -journal) from OPFS, retrying a few times if needed (e.g. conn not closed immediately)
 */
export async function deleteDBFromOPFS({ dbname, syncActiveStore, dbCache }: Params) {
	// Close relevant connections
	//
	// Stop the sync -- this is useful if overwriting the current DB, but doesn't hurt otherwise
	syncActiveStore.set(false);
	//
	// Close the DB if cached (current or used in the session)
	const cached = dbCache.get(dbname);
	if (cached) {
		const { db } = await cached;
		await db.close();
		dbCache.delete(dbname);
	}

	const dir = await window.navigator.storage.getDirectory();

	// If overwriting an existing file, remove it (and its corresponding wal and journal) first
	// if the files don't exist - noop
	const removeArtefact = async (name: string) => {
		if (!(await checkOPFSFileExists(name))) return;
		await dir.removeEntry(name);
	};

	// NOTE: running with retries to make sure the file locks were released
	await retry(() => removeArtefact(dbname), 100, 5);
	await retry(() => removeArtefact(`${dbname}-wal`), 100, 5);
	await retry(() => removeArtefact(`${dbname}-journal`), 100, 5);
}

export async function checkOPFSFileExists(fname: string) {
	const dir = await window.navigator.storage.getDirectory();
	try {
		await dir.getFileHandle(fname, { create: false });
		return true;
	} catch (err) {
		// Predictable
		if ((err as Error).name === "NotFoundError") {
			return false;
		}

		// Unknown - throw
		throw err;
	}
}
