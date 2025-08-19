export function createVFSFactory(): (module: SQLiteAPI) => Promise<SQLiteVFS> {
	return async (module: SQLiteAPI) => {
		const { IDBBatchAtomicVFS: VFS } = await import("@vlcn.io/wa-sqlite/src/examples/IDBBatchAtomicVFS.js");
		return VFS.create("idb-batch-atomic", module) as SQLiteVFS;
	};
}
