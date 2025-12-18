import { type Writable, writable } from "svelte/store";

import type { DBAsync } from "$lib/db/cr-sqlite/types";
import { getDB, type DbCtx, getSchemaNameAndVersion, schemaName, schemaVersion } from "$lib/db/cr-sqlite/db";
import type { ProgressState } from "$lib/types";

import { retry } from "$lib/utils/misc";

function uuidV4Bytes() {
	const b = new Uint8Array(16);
	crypto.getRandomValues(b);

	// version = 4
	b[6] = (b[6] & 0x0f) | 0x40;
	// variant = RFC 4122
	b[8] = (b[8] & 0x3f) | 0x80;

	return b;
}

/**
 * Re-identifies a DB node: updates the siteid, as well as `crsql_site_id`, `crsql_tracked_peers`, `*__crsql_clock` tables.
 *
 * This is done when we retrieve an exact copy of a DB from another node (with ids and respective crsql links) and we want to have it reidentified:
 * - generating a new siteid for the node
 * - updating tracked peers to only include the origin node and attributing all tracked changes to it (as if we synced from it)
 */
export async function reidentifyDbNode(db: DBAsync) {
	await db.tx(async (txDb) => {
		// Delete existing tracked peers (if any), those are unfamiliar to a new node
		await txDb.exec("DELETE FROM crsql_tracked_peers");
		// Delete existin peers' site ids (if any), keeping only the origin
		// (origin being the site id of the node we copied this from, found in the table with ordinal = 0)
		await txDb.exec("DELETE FROM crsql_site_id WHERE ordinal != 0");

		// Bump the origin ordinal to 1 (this is our only peer now)
		await txDb.exec("UPDATE crsql_site_id SET ordinal = 1 WHERE ordinal = 0");
		// Generate a new id for the node (ordinal = 0)
		const siteid = uuidV4Bytes();
		await txDb.exec("INSERT INTO crsql_site_id (site_id, ordinal) VALUES (?, ?)", [siteid, 0]);

		// Store origin as a tracked peer (this is required to avoid re-syncing everything -- pulling changes since the beginning of time)
		const [[origin_site_id]] = await txDb.execA<[Uint8Array]>("SELECT site_id FROM crsql_site_id WHERE ordinal = 1");
		const [[db_version]] = await txDb.execA<[number]>("SELECT MAX(db_version) FROM crsql_changes");
		// Value inferred from usage (inspecting sync worker and ws-server impl)
		await txDb.exec("INSERT INTO crsql_tracked_peers (site_id, event, version, seq, tag) VALUES (?, 0, ?, 0, 0)", [
			origin_site_id,
			db_version
		]);

		// Attribute all tracked changes to origin node
		const crsql_clock_tables = await txDb.execA<[string]>("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE '%crsql_clock'");
		for (const [tbl] of crsql_clock_tables) {
			await txDb.exec(`UPDATE ${tbl} SET site_id = 1`);
		}
	});
}

/**
 * Validates a fetched database file to ensure it's a valid SQLite database with the correct schema.
 *
 * @param dbname The name of the database file in OPFS to validate.
 * @returns The opened database handle if validation succeeds.
 * @throws Error if validation fails (closes the DB before throwing).
 */
async function validateFetchedDB(db: DBAsync): Promise<void> {
	// Quick integrity check (faster than full integrity_check)
	const [[res]] = await db.execA<[string]>("PRAGMA quick_check");
	if (res !== "ok") {
		throw new Error(`Database integrity check failed: ${res}`);
	}

	// Check schema exists and matches
	const schemaRes = await getSchemaNameAndVersion(db);
	if (!schemaRes) {
		throw new Error("Database has no schema (not initialized)");
	}

	const [name, version] = schemaRes;
	if (name !== schemaName || version !== schemaVersion) {
		throw new Error(`Schema mismatch: expected ${schemaName}@${schemaVersion}, got ${name}@${version}`);
	}
}

/**
 * Fetches the DB file (.sqlite3) from the provided URL and stores it in OPFS under the given target name.
 * Validates the fetched file is a valid SQLite database with the correct schema.
 * On any error (fetch failure, validation failure), ensures proper cleanup and file deletion if needed.
 *
 * @param url The URL to fetch the DB file from.
 * @param target The target filename in OPFS (e.g., 'mydb.sqlite3').
 * @param progressStore Optional Svelte writable store to track progress. If not provided, a new one will be created.
 */
export async function fetchAndStoreDBFile(url: string, target: string, progressStore: Writable<ProgressState> = writable<ProgressState>()) {
	const root = await navigator.storage.getDirectory();
	const fileHandle = await root.getFileHandle(target, { create: true });
	const writable = await fileHandle.createWritable();

	const deleteTargetFile = async () => {
		if (!(await checkOPFSFileExists(target))) return;
		await root.removeEntry(target);
	};

	try {
		// Fetch
		const res = await fetch(url);
		if (!res.ok || !res.body) {
			throw new Error(`Failed to fetch ${url}: ${res.status} ${res.statusText}`);
		}

		const contentLength = parseInt(res.headers.get("Content-Length") || "0", 10);
		if (!contentLength) throw new Error("Content-Length header is missing or invalid");

		progressStore.set({ active: true, nProcessed: 0, nTotal: contentLength });
		let received = 0;

		// Stream write (from res stream to OPFS)
		const reader = res.body.getReader();
		// eslint-disable-next-line no-constant-condition
		while (true) {
			const { done, value } = await reader.read();
			if (done) break;

			await writable.write(value);
			received += value.length;

			progressStore.set({ active: true, nProcessed: received, nTotal: contentLength });
		}

		// Verify we received the expected amount
		if (received !== contentLength) {
			throw new Error(`Incomplete download: expected ${contentLength} bytes, got ${received}`);
		}
	} catch (err) {
		await writable.abort();
		await retry(deleteTargetFile, 100, 5);
		throw err;
	}
	await writable.close();

	// TODO: update progress to show a loading spinner (idea: nProcessed > nTotal -- unkonwn remaining -- loading spinner)

	try {
		// Validate SQLite magic header
		const file = await fileHandle.getFile();
		const buf = await file.arrayBuffer();
		const view = new Uint8Array(buf, 0, Math.min(100, buf.byteLength));

		if (view.length < 16) {
			throw new Error("File too small to be a valid SQLite DB");
		}

		// Check magic header: "SQLite format 3" (bytes 0-15)
		const magic = Array.from(view.slice(0, 15));
		const expected = [83, 81, 76, 105, 116, 101, 32, 102, 111, 114, 109, 97, 116, 32, 51]; // "SQLite format 3"
		if (!magic.every((byte, i) => byte === expected[i])) {
			throw new Error("Invalid SQLite file: magic header mismatch");
		}

		// Check and fix WAL mode (if needed)
		if (view.length >= 20) {
			const isWal = view[18] === 0x02 || view[19] === 0x02;
			if (isWal) {
				const walWritable = await fileHandle.createWritable({ keepExistingData: true });
				// Make sure the file header says: no WAL (use rollback mode)
				await walWritable.write({ type: "write", position: 18, data: new Uint8Array([0x01]) });
				await walWritable.write({ type: "write", position: 19, data: new Uint8Array([0x01]) });
				await walWritable.close();
			}
		}
	} catch (err) {
		await retry(deleteTargetFile, 100, 5);
		throw err;
	}

	const vfs = "sync-opfs-coop-sync";
	const db = await getDB(target, vfs);

	// Validate and process the file (wrap in try-catch to delete file on any error)
	try {
		// Validate DB integrity and schema
		await validateFetchedDB(db);

		// Re-identify the DB node (the fetched copy is the exact same as the server one, incl. siteid):
		// - assign new siteid
		// - attribute all *__crsql_clock tracked changes to server (as if they were synced to a pristine DB in the current node)
		await reidentifyDbNode(db);
	} catch (err) {
		await db.close();
		await retry(deleteTargetFile, 100, 5);

		throw err;
	} finally {
		// Cleanup
		//
		// NOTE: no need to clear the cache -- the DB was opened using 'getDB'
		// which doesn't cache (unlike 'getInitializedDB')
		progressStore.set({ active: false, nProcessed: 0, nTotal: 0 });
	}

	// Close the DB before handing the control back to the caller (on success)
	await db.close();
}

/**
 * A util used to delete the DB from OPFS, it deletes the DB file (and its -wal and -journal) from OPFS,
 * retrying a few times if needed (e.g. conn not closed immediately)
 *
 * NOTE: This is safe if the file doesn't exist (will simply exit early)
 *
 * WARNING: This assumes the DB file is not locked and no entity holds reference to the file. Use with care. Prefer `deleteDBFromOPFS`
 * exported from `"$lib/app/db"`
 */
export async function deleteDBFromOPFS(dbid: string) {
	const dir = await window.navigator.storage.getDirectory();

	const removeArtefact = async (name: string) => {
		if (!(await checkOPFSFileExists(name))) return;
		await dir.removeEntry(name);
	};

	// NOTE: running with retries to make sure the file locks were released
	// NOTE: deleting -wal and -journal as well (if exist, if not -- noop)
	await retry(() => removeArtefact(dbid), 100, 5);
	await retry(() => removeArtefact(`${dbid}-wal`), 100, 5);
	await retry(() => removeArtefact(`${dbid}-journal`), 100, 5);
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

type FileSystemFileHandleExt = FileSystemFileHandle & {
	move(dest: string): Promise<void>;
	move(destDir: FileSystemDirectoryHandle, dest?: string): Promise<void>;
};

async function moveImpl(
	srcDir: FileSystemDirectoryHandle,
	srcHandle: FileSystemFileHandle,
	destDir: FileSystemDirectoryHandle,
	destName: string
): Promise<void> {
	// Fallback impl:
	// 1. create dest
	// 2. copy from src to dest
	// 3. delete src
	const srcFile = await srcHandle.getFile();
	const srcBuf = await srcFile.arrayBuffer();

	const destHandle = await destDir.getFileHandle(destName);
	const destWritable = await destHandle.createWritable();

	await destWritable.write(srcBuf);
	await destWritable.close();

	await srcDir.removeEntry(srcHandle.name);
}

/**
 * Wraps file handle
 */
export function wrapFileHandle(dirHandle: FileSystemDirectoryHandle, fileHandle: FileSystemFileHandle): FileSystemFileHandleExt {
	const move = async (...params: any[]) => {
		const srcDir = dirHandle;
		const srcHandle = fileHandle;

		// Case params = [destName]
		if (typeof params[0] === "string") {
			const destDir = await window.navigator.storage.getDirectory();
			const dest = params[0];
			return moveImpl(srcDir, srcHandle, destDir, dest);
		}

		// Case params = [destDirHandle, destName?]
		const destDir = params[0] as FileSystemDirectoryHandle;
		// If dest name not provided, use the same name as current file
		const dest = params[0] || srcHandle.name;
		return moveImpl(srcDir, srcHandle, destDir, dest);
	};

	// Happy path: Google Chrome (for instance) supports FileSystemFileHandle.move(...),
	// if .move provided, use the native impl
	if ("move" in fileHandle) {
		return fileHandle as FileSystemFileHandleExt;
	}

	return Object.assign(fileHandle, { move });
}
