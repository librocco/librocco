import { zipSync, strToU8 } from "fflate";

import { VERSION, GIT_SHA } from "$lib/constants";
import { deleteDBFromOPFS, wrapFileHandle } from "$lib/db/cr-sqlite/core/utils";
import { terminateAllWorkers } from "$lib/db/cr-sqlite/core/worker-db";

/**
 * Exports the current app state (SQLite DB + localStorage config) as a zip archive.
 *
 * The archive contains:
 * - `db/<dbid>` — the raw SQLite database file from OPFS
 * - `config.json` — all relevant localStorage entries plus version metadata
 */
export async function exportStateArchive(dbid: string): Promise<void> {
	// 1. Read the DB file from OPFS
	let dbBytes: Uint8Array;
	try {
		if (typeof navigator === "undefined" || !navigator.storage?.getDirectory) {
			throw new Error("OPFS storage API is not available in this browser context");
		}
		const dir = await navigator.storage.getDirectory();
		const fileHandle = await dir.getFileHandle(dbid);
		const file = await fileHandle.getFile();
		dbBytes = new Uint8Array(await file.arrayBuffer());
	} catch (error) {
		const detail = error instanceof Error ? error.message : String(error);
		throw new Error(`exportStateArchive failed for db "${dbid}": ${detail}`);
	}

	// 2. Collect localStorage config
	const config: Record<string, string> = {};
	for (let i = 0; i < localStorage.length; i++) {
		const key = localStorage.key(i)!;
		if (key.startsWith("librocco") || key === "lang" || key === "vfs") {
			config[key] = localStorage.getItem(key)!;
		}
	}

	// 3. Build the config JSON with metadata
	const configPayload = {
		_meta: {
			version: VERSION,
			gitSha: GIT_SHA,
			exportedAt: new Date().toISOString()
		},
		...config
	};
	const configBytes = strToU8(JSON.stringify(configPayload, null, 2));

	// 4. Create the zip archive
	const zipped = zipSync({
		[`db/${dbid}`]: dbBytes,
		"config.json": configBytes
	});

	// 5. Download via blob URL + anchor click
	const date = new Date().toISOString().slice(0, 10);
	const filename = `librocco-export-${dbid}-${date}.zip`;
	// BlobPart typing expects an ArrayBuffer-backed view; copy to satisfy TS/runtime compatibility.
	const zipBytes = Uint8Array.from(zipped);
	const blob = new Blob([zipBytes], { type: "application/zip" });
	const url = URL.createObjectURL(blob);
	const a = document.createElement("a");
	a.href = url;
	a.download = filename;
	document.body.appendChild(a);
	a.click();
	document.body.removeChild(a);
	URL.revokeObjectURL(url);
}

async function writeDbBytesToOPFS(bytes: Uint8Array, dbid: string): Promise<void> {
	if (bytes.length < 16) throw new Error("File too small to be a valid SQLite DB");
	const magic = [83, 81, 76, 105, 116, 101, 32, 102, 111, 114, 109, 97, 116, 32, 51]; // "SQLite format 3"
	if (!magic.every((b, i) => bytes[i] === b)) throw new Error("Invalid SQLite file: magic header mismatch");

	// Release all OPFS file handles held by workers, then wait briefly for the OS to free them
	terminateAllWorkers();
	await new Promise<void>((r) => setTimeout(r, 300));

	// Write to a temp file first so the live DB is only removed after the write succeeds
	const root = await navigator.storage.getDirectory();
	const tempDbid = `${dbid}-temp`;
	const fh = await root.getFileHandle(tempDbid, { create: true });
	const ws = await fh.createWritable();
	await ws.write(bytes.buffer as ArrayBuffer);
	await ws.close();

	await deleteDBFromOPFS(dbid);
	await wrapFileHandle(root, fh).move(dbid);

	window.location.reload();
}

/**
 * Imports a raw SQLite file into OPFS as the active database, then reloads the page.
 * Terminates any running DB workers first to release OPFS file handles.
 */
export async function importStateArchive(file: File, dbid: string): Promise<void> {
	await writeDbBytesToOPFS(new Uint8Array(await file.arrayBuffer()), dbid);
}

/**
 * Fetches a raw SQLite file from a URL, writes it into OPFS as the active database, then reloads.
 * Useful for loading a known debug snapshot without a file picker (e.g. from dev server).
 */
export async function importStateArchiveFromUrl(url: string, dbid: string): Promise<void> {
	const res = await fetch(url);
	if (!res.ok) throw new Error(`Failed to fetch DB from "${url}": ${res.status} ${res.statusText}`);
	await writeDbBytesToOPFS(new Uint8Array(await res.arrayBuffer()), dbid);
}
