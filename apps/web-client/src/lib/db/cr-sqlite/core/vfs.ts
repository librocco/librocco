const vfsLookup = {
	"asyncify-idb-batch-atomic": () =>
		import("@vlcn.io/wa-sqlite/src/examples/IDBBatchAtomicVFS.js").then((module) => module.IDBBatchAtomicVFS),

	"asyncify-opfs-any-context": () =>
		import("@vlcn.io/wa-sqlite/src/examples/OPFSAnyContextVFS.js").then((module) => module.OPFSAnyContextVFS),

	"asyncify-opfs-adaptive": () => import("@vlcn.io/wa-sqlite/src/examples/OPFSAdaptiveVFS.js").then((module) => module.OPFSAdaptiveVFS),

	// NOTE: the following are the same VFS (and the same module), but used with different WASM builds, so here for exhaustiveness
	"asyncify-opfs-coop-sync": () => import("@vlcn.io/wa-sqlite/src/examples/OPFSCoopSyncVFS.js").then((module) => module.OPFSCoopSyncVFS),
	"sync-opfs-coop-sync": () => import("@vlcn.io/wa-sqlite/src/examples/OPFSCoopSyncVFS.js").then((module) => module.OPFSCoopSyncVFS),

	// NOTE: the following only works with (still experimental) JSPI builds
	"jspi-opfs-permuted": () => import("@vlcn.io/wa-sqlite/src/examples/OPFSAdaptiveVFS.js").then((module) => module.OPFSAdaptiveVFS)
};

export type VFSWhitelist = keyof typeof vfsLookup;

export function createVFSFactory(vfs: VFSWhitelist): (module: SQLiteAPI) => Promise<SQLiteVFS> {
	if (!validateVFS(vfs)) {
		throw new Error("unknown vfs: " + vfs);
	}

	return async (module: SQLiteAPI) => {
		const VFS = await vfsLookup[vfs]();
		return VFS.create(vfs, module) as SQLiteVFS;
	};
}

export function validateVFS(vfs: string): vfs is VFSWhitelist {
	return Boolean(vfsLookup[vfs]);
}

export const opfsVFSList = new Set<VFSWhitelist>([
	"asyncify-opfs-any-context",
	"asyncify-opfs-adaptive",
	"asyncify-opfs-coop-sync",
	"sync-opfs-coop-sync",
	"jspi-opfs-permuted"
]);

export function vfsSupportsOPFS(vfs: string): vfs is VFSWhitelist {
	return opfsVFSList.has(vfs as VFSWhitelist);
}
