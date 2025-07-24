import initWasm from "@vlcn.io/crsqlite-wasm";
import wasmUrl from "@vlcn.io/crsqlite-wasm/crsqlite.wasm?url";

import type { DBAsync } from "./types";

import { DEFAULT_VFS } from "$lib/constants";

import { createVFSFactory } from "./vfs";

export async function getCrsqliteDB(dbname: string): Promise<DBAsync> {
	const sqlite = await initWasm({
		locateWasm: () => wasmUrl,
		vfsFactory: createVFSFactory(DEFAULT_VFS)
	});
	return sqlite.open(dbname);
}
