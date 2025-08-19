import * as Comlink from "comlink";

import type { DBAsync, OnUpdateCallback, StmtAsync, TMutex, TXCallback, _TXAsync } from "./types";

import DBWorker from "./worker-db.worker?worker";
import type { MsgInit } from "./worker-db.worker";

export async function getWorkerDB(dbname: string, vfs: string): Promise<DBAsync> {
	const wkr = await initWorker(dbname, vfs);

	const ifc = Comlink.wrap<DBAsync>(wkr);
	const [__mutex, siteid, filename, tablesUsedStmt] = await Promise.all([ifc.__mutex, ifc.siteid, ifc.filename, ifc.tablesUsedStmt]);

	return new WorkerDB(ifc, __mutex, siteid, filename, tablesUsedStmt);
}

function initWorker(dbname: string, vfs: string) {
	const name = [dbname, vfs].join("---");
	const wkr = new DBWorker({ name });

	return new Promise<Worker>((resolve, reject) => {
		const listener = (e: MessageEvent) => {
			console.log("[worker message] msg received", JSON.stringify(e.data));
			const isInitMsg = (e: MessageEvent): e is MessageEvent<MsgInit> => e.data?._type === "wkr-init";
			if (!isInitMsg(e)) return;
			switch (e.data.status) {
				case "ok": {
					console.log("[worker message] ready!");
					wkr.removeEventListener("message", listener);
					return resolve(wkr);
				}
				case "error": {
					console.log("[worker message] error!");
					wkr.removeEventListener("message", listener);
					const err = new Error(e.data.error);
					if (e.data.stack) {
						err.stack = e.data.stack;
					}
					return reject(err);
				}
			}
		};
		wkr.addEventListener("message", listener);
	});
}

class WorkerDB implements DBAsync {
	constructor(
		readonly remote: Comlink.Remote<DBAsync>,
		// TODO: running the mutex over a Comlink proxy might not be the terribly performant solution,
		// check if we should implement a local mutex here.
		readonly __mutex: TMutex,
		readonly siteid: string,
		readonly filename: string,
		readonly tablesUsedStmt: StmtAsync
	) {}

	prepare(sql: string) {
		return this.remote.prepare(sql);
	}

	exec(sql: string, bind: SQLiteCompatibleType[]) {
		return this.remote.exec(sql, bind);
	}

	execMany(sql: string[]) {
		return this.remote.execMany(sql);
	}

	execO<O extends Record<string, any>>(sql: string, bind: SQLiteCompatibleType[]) {
		return this.remote.execO(sql, bind) as Promise<O[]>;
	}

	execA<T extends any[]>(sql: string, bind: SQLiteCompatibleType[]) {
		return this.remote.execA(sql, bind) as Promise<T[]>;
	}

	close() {
		return this.remote.close();
	}

	createFunction(name: string, fn: (...args: any) => unknown, opts?: Record<string, any>) {
		return this.remote.createFunction(name, Comlink.proxy(fn), opts);
	}

	onUpdate(cb: OnUpdateCallback): () => void {
		// NOTE: everything done over the wire is a Promise, whereas 'onUpdate' signature expects the unsubscribe function
		// to be returned immediately, so we create a function that (internally) waits for the unsubscribe and calls it
		const res = this.remote.onUpdate(Comlink.proxy(cb));
		return () => res.then((unsubscribe) => unsubscribe()); // Everything done over the wire is a Promise
	}

	tx(cb: TXCallback): Promise<void> {
		return this.remote.tx(Comlink.proxy(cb));
	}

	imperativeTx(): Promise<[() => void, _TXAsync]> {
		return this.remote.imperativeTx();
	}

	automigrateTo(schemaName: string, schemaContent: string): Promise<"noop" | "apply" | "migrate"> {
		return this.remote.automigrateTo(schemaName, schemaContent);
	}
}
