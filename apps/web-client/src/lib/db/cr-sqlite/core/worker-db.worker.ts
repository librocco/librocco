import * as Comlink from "comlink";

import type { DBAsync, _TXAsync, OnUpdateCallback, TXCallback, VFSWhitelist } from "./types";

import { getCrsqliteDB } from "./init";

export type MsgInitOk = { _type: "wkr-init"; status: "ok" };
export type MsgWkrError = { _type: "wkr-init"; status: "error"; error: string; stack?: string };
export type MsgInit = MsgInitOk | MsgWkrError;

async function start() {
	try {
		const [dbname, vfs] = self.name.split("---") as [string, VFSWhitelist];
		console.log(`[worker] initialising db, using: dbname: ${dbname}, vfs: ${vfs}`);
		if (!dbname || !vfs) {
			throw new Error("Invalid worker name format. Expected '<dbname>---<vfs>'.");
		}

		const _db = await getCrsqliteDB(dbname, vfs);
		console.log(`[worker] db initialised!`);

		const db = wrapDB(_db);
		Comlink.expose(db);

		console.log(`[worker] db exposed, sending ok msg...`);
		const msg: MsgInitOk = { _type: "wkr-init", status: "ok" };
		self.postMessage(msg);
	} catch (e) {
		const msg: MsgWkrError = { _type: "wkr-init", status: "error", error: (e as Error).message, stack: (e as Error).stack };
		self.postMessage(msg);
	}
}
start();

class WrappedDB implements DBAsync {
	constructor(readonly internal: DBAsync) {}

	get __mutex() {
		return this.internal.__mutex;
	}
	get siteid() {
		return this.internal.siteid;
	}
	get filename() {
		return this.internal.filename;
	}
	get tablesUsedStmt() {
		return Comlink.proxy(this.internal.tablesUsedStmt);
	}

	prepare(sql: string) {
		return this.internal.prepare(sql);
	}

	exec(sql: string, bind: SQLiteCompatibleType[]) {
		return this.internal.exec(sql, bind);
	}

	execMany(sql: string[]) {
		return this.internal.execMany(sql);
	}

	execO<O extends {}>(sql: string, bind: SQLiteCompatibleType[]) {
		return this.internal.execO(sql, bind) as Promise<O[]>;
	}

	execA<T extends any[]>(sql: string, bind: SQLiteCompatibleType[]) {
		return this.internal.execA(sql, bind) as Promise<T[]>;
	}

	close() {
		return this.internal.close();
	}

	createFunction(name: string, fn: (...args: any) => unknown, opts?: {}) {
		return this.internal.createFunction(name, Comlink.proxy(fn), opts);
	}

	onUpdate(cb: OnUpdateCallback): () => void {
		// NOTE: `db.onUpdate` returns a function (unsubscribe) that needs to be proxied (Comlink.proxy) when being
		// returned to the main thread.
		const unsubscribe = this.internal.onUpdate(cb);
		return Comlink.proxy(unsubscribe);
	}

	tx(cb: TXCallback): Promise<void> {
		// NOTE: `db.tx` is called by passing the callback. When calling from the main thread, the callback needs to be
		// proxied (using Comlink.proxy). Furthermore, when calling the proxied callback (from worker to the main thread),
		// the first parameter (the TXAsync object) needs to be proxied back as well.
		// Adapt the 'cb' so that the first param (TXAsync) is proxied back when calling
		const adapt = (cb: TXCallback): TXCallback => {
			return (tx) => cb(Comlink.proxy(tx));
		};
		return this.internal.tx(adapt(cb));
	}

	async imperativeTx(): Promise<[() => void, _TXAsync]> {
		// NOTE: `db.imperativeTx` returns releaser and TXAsync object, both of which need to be proxied.
		const [releaser, tx] = await this.internal.imperativeTx();
		return [Comlink.proxy(releaser), Comlink.proxy(tx)];
	}

	automigrateTo(schemaName: string, schemaContent: string): Promise<"noop" | "apply" | "migrate"> {
		return this.internal.automigrateTo(schemaName, schemaContent);
	}
}

function wrapDB(db: DBAsync) {
	return new WrappedDB(db);
}

