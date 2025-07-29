import type { DB } from "@vlcn.io/crsqlite-wasm";

export const getWorkerDB = async (dbname: string, vfs: string): Promise<DB> => {
	throw new Error("not implemented");
};
