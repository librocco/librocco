import initWasm from "@vlcn.io/crsqlite-wasm";
import wasmUrl from "@vlcn.io/crsqlite-wasm/crsqlite.wasm?url";

import type { DBAsync, VFSWhitelist } from "./types";

import { createVFSFactory } from "./vfs";

export async function getCrsqliteDB(dbname: string, vfs: VFSWhitelist): Promise<DBAsync> {
	const sqlite = await initWasm({
		locateWasm: () => wasmUrl,
		vfsFactory: createVFSFactory(vfs)
	});
	return sqlite.open(dbname);
}
