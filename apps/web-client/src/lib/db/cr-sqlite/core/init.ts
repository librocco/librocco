import initWasm, { type DB } from "@vlcn.io/crsqlite-wasm";
import wasmUrl from "@vlcn.io/crsqlite-wasm/crsqlite.wasm?url";


export async function getCrsqliteDB(dbname: string): Promise<DB> {
	const { createVFSFactory } = await import("./vfs");
	const sqlite = await initWasm({
		locateWasm: () => wasmUrl,
		vfsFactory: createVFSFactory()
	});
	return sqlite.open(dbname);
}
