import { createWasmInitializer } from "@vlcn.io/crsqlite-wasm";

import wasmSync from "@vlcn.io/wa-sqlite/dist/crsqlite-sync.wasm?url";
import wasmAsyncify from "@vlcn.io/wa-sqlite/dist/crsqlite.wasm?url";
import wasmJSPI from "@vlcn.io/wa-sqlite/dist/crsqlite-jspi.wasm?url";

import type { DBAsync, VFSWhitelist } from "./types";

import { createVFSFactory } from "./vfs";

type BuildArtefacts = {
	wasmUrl: string;
	getModule: () => Promise<any>;
};

const wasmBuildArtefacts: Record<"sync" | "asyncify" | "jspi", BuildArtefacts> = {
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

const vfsWasmLookup: Record<VFSWhitelist, "sync" | "asyncify" | "jspi"> = {
	"asyncify-idb-batch-atomic": "asyncify",
	"asyncify-opfs-any-context": "asyncify",
	"asyncify-opfs-adaptive": "asyncify",

	"asyncify-opfs-coop-sync": "asyncify",
	"sync-opfs-coop-sync": "sync",

	"jspi-opfs-permuted": "jspi"
};

export function getWasmBuildArtefacts(vfs: VFSWhitelist) {
	return wasmBuildArtefacts[vfsWasmLookup[vfs]];
}

export async function getCrsqliteDB(dbname: string, vfs: VFSWhitelist): Promise<DBAsync> {
	const { wasmUrl, getModule } = wasmBuildArtefacts[vfsWasmLookup[vfs]];

	const ModuleFactory = await getModule();
	const vfsFactory = createVFSFactory(vfs);

	const initializer = createWasmInitializer({ ModuleFactory, vfsFactory });
	const sqlite = await initializer(() => wasmUrl);
	return sqlite.open(dbname);
}
