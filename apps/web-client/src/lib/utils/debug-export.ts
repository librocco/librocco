import { zipSync, strToU8 } from "fflate";

import { VERSION, GIT_SHA } from "$lib/constants";

/**
 * Exports the current app state (SQLite DB + localStorage config) as a zip archive.
 *
 * The archive contains:
 * - `db/<dbid>` — the raw SQLite database file from OPFS
 * - `config.json` — all relevant localStorage entries plus version metadata
 */
export async function exportStateArchive(dbid: string): Promise<void> {
	// 1. Read the DB file from OPFS
	const dir = await navigator.storage.getDirectory();
	const fileHandle = await dir.getFileHandle(dbid);
	const file = await fileHandle.getFile();
	const dbBytes = new Uint8Array(await file.arrayBuffer());

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

	const blob = new Blob([zipped.buffer as ArrayBuffer], { type: "application/zip" });
	const url = URL.createObjectURL(blob);
	const a = document.createElement("a");
	a.href = url;
	a.download = filename;
	document.body.appendChild(a);
	a.click();
	document.body.removeChild(a);
	URL.revokeObjectURL(url);
}
