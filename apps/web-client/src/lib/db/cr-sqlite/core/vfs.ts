const idbBatchAtomic = async (module: SQLiteAPI): Promise<SQLiteVFS> => {
	const { IDBBatchAtomicVFS } = await import("@vlcn.io/wa-sqlite/src/examples/IDBBatchAtomicVFS.js");
	const vfs = IDBBatchAtomicVFS.create("idb-batch-atomic", module);
	return vfs;
};

const opfsAnyContext = async (module: SQLiteAPI): Promise<SQLiteVFS> => {
	const { OPFSAnyContextVFS } = await import("@vlcn.io/wa-sqlite/src/examples/OPFSAnyContextVFS.js");
	const vfs = await OPFSAnyContextVFS.create("opfs-any-context", module);
	return vfs;
};

const vfsLookup = {
	"idb-batch-atomic": idbBatchAtomic,
	"opfs-any-context": opfsAnyContext
};

export type VFSWhitelist = keyof typeof vfsLookup;

export function createVFSFactory(vfs: VFSWhitelist): (module: SQLiteAPI) => Promise<SQLiteVFS> {
	if (!(vfs in vfsLookup)) {
		throw new Error("unknown vfs: " + vfs);
	}
	return vfsLookup[vfs];
}
