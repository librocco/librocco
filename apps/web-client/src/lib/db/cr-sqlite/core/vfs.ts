const vfsLookup = {
	"idb-batch-atomic": () => import("@vlcn.io/wa-sqlite/src/examples/IDBBatchAtomicVFS.js").then((module) => module.IDBBatchAtomicVFS),
	"opfs-any-context": () => import("@vlcn.io/wa-sqlite/src/examples/OPFSAnyContextVFS.js").then((module) => module.OPFSAnyContextVFS),
	"opfs-adaptive-vfs": () => import("@vlcn.io/wa-sqlite/src/examples/OPFSAdaptiveVFS.js").then((module) => module.OPFSAdaptiveVFS),
	"opfs-coop-sync": () => import("@vlcn.io/wa-sqlite/src/examples/OPFSCoopSyncVFS.js").then((module) => module.OPFSCoopSyncVFS)
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
