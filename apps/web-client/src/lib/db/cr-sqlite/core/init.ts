// NOTE: The `@vlcn.io/crsqlite-wasm` library has a type error - `initWasm` doesn't accept `APIFactory`
// in its type definition, but we need to pass it to support multiple WASM builds (sync, asyncify, jspi).
// Using a type assertion to work around this library limitation.
import initWasm from "@vlcn.io/crsqlite-wasm";

import wasmSync from "@vlcn.io/wa-sqlite/dist/crsqlite-sync.wasm?url";
import wasmAsyncify from "@vlcn.io/wa-sqlite/dist/crsqlite.wasm?url";
import wasmJSPI from "@vlcn.io/wa-sqlite/dist/crsqlite-jspi.wasm?url";

import type { DBAsync, VFSWhitelist } from "./types";

import { createVFSFactory } from "./vfs";

const wasmBuildArtefacts = {
	sync: {
		wasmUrl: wasmSync,
		getModule: () => import("@vlcn.io/wa-sqlite/dist/crsqlite-sync.mjs").then((m) => m.default)
	},
	asyncify: {
		wasmUrl: wasmAsyncify,
		getModule: () => import("@vlcn.io/wa-sqlite/dist/crsqlite.mjs").then((m) => m.default)
	},
	jspi: {
		wasmUrl: wasmJSPI,
		getModule: () => import("@vlcn.io/wa-sqlite/dist/crsqlite-jspi.mjs").then((m) => m.default)
	}
};

const vfsWasmLookup: Record<VFSWhitelist, keyof typeof wasmBuildArtefacts> = {
	"asyncify-idb-batch-atomic": "asyncify",
	"asyncify-opfs-any-context": "asyncify",
	"asyncify-opfs-adaptive": "asyncify",

	"asyncify-opfs-coop-sync": "asyncify",
	"sync-opfs-coop-sync": "sync",

	"jspi-opfs-permuted": "jspi"
};

export async function getCrsqliteDB(dbname: string, vfs: VFSWhitelist): Promise<DBAsync> {
	const { wasmUrl, getModule } = wasmBuildArtefacts[vfsWasmLookup[vfs]];
	const APIFactory = await getModule();

	const sqlite = await initWasm({
		APIFactory,
		locateWasm: () => wasmUrl,
		vfsFactory: createVFSFactory(vfs)
	} as any);
	return sqlite.open(dbname);
}
