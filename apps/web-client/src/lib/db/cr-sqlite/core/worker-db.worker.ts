import * as Comlink from "comlink";
import { type Config, defaultConfig } from "@vlcn.io/ws-client";
import { start as startSync } from "@vlcn.io/ws-client/worker.js";

import type { DBAsync, _TXAsync, OnUpdateCallback, TXCallback, VFSWhitelist } from "./types";
import { getCrsqliteDB } from "./init";

import { SyncTransportController, SyncEventEmitter } from "../../../workers/sync-transport-control";
import type { SyncConfig } from "../../../workers/sync-transport-control";
import type { MsgStart, MsgChangesReceived, MsgChangesProcessed, MsgProgress, MsgReady } from "../../../workers/types";

export type MsgInitOk = { _type: "wkr-init"; status: "ok" };
export type MsgWkrError = { _type: "wkr-init"; status: "error"; error: string; stack?: string };
export type MsgInit = MsgInitOk | MsgWkrError;

type InboundMessage = MsgStart;
type OutboundMessage = MsgChangesReceived | MsgChangesProcessed | MsgProgress | MsgReady;

const MAX_SYNC_CHUNK_SIZE = 1024;

let dbInstance: DBAsync | null = null;

async function start() {
	try {
		const [dbname, vfs] = self.name.split("---") as [string, VFSWhitelist];
		console.log(`[worker] initialising db, using: dbname: ${dbname}, vfs: ${vfs}`);
		if (!dbname || !vfs) {
			throw new Error("Invalid worker name format. Expected '<dbname>---<vfs>'.");
		}

		const _db = await getCrsqliteDB(dbname, vfs);
		dbInstance = _db;
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

// Sync Logic
self.addEventListener("message", (e) => {
	const msg = e.data as InboundMessage;
	if (msg._type === "start") {
		handleStartSync(msg.payload);
	}
});

function sendMessage(msg: OutboundMessage) {
	self.postMessage(msg);
}

function handleStartSync(payload: MsgStart["payload"]) {
	console.log("[worker] starting sync...");

	const dbProvider: Config["dbProvider"] = async (dbname: string) => {
		// Return the already initialized DB instance
		if (!dbInstance) {
			throw new Error("DB not initialized yet");
		}
		return dbInstance;
	};

	const config: Config = {
		dbProvider,
		transportProvider: wrapTransportProvider(defaultConfig.transportProvider, createProgressEmitter(), {
			maxChunkSize: MAX_SYNC_CHUNK_SIZE
		})
	};

	startSync(config);
	self.postMessage({ _type: "ready" }); // Notify that sync is ready
}

function createProgressEmitter() {
	const progressEmitter = new SyncEventEmitter();
	progressEmitter.onChangesReceived((payload) => sendMessage({ _type: "changesReceived", payload }));
	progressEmitter.onChangesProcessed((payload) => sendMessage({ _type: "changesProcessed", payload }));
	progressEmitter.onProgress((payload) => sendMessage({ _type: "progress", payload }));
	return progressEmitter;
}

function wrapTransportProvider(provider: Config["transportProvider"], emitter: SyncEventEmitter, config: SyncConfig): Config["transportProvider"] {
	return (...params: Parameters<Config["transportProvider"]>) => new SyncTransportController(provider(...params), emitter, config);
}

class WrappedDB implements DBAsync {
	constructor(readonly internal: DBAsync) { }

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

	async prepare(sql: string) {
		const stmt = await this.internal.prepare(sql);
		return Comlink.proxy(stmt);
	}

	exec(sql: string, bind: SQLiteCompatibleType[]) {
		return this.internal.exec(sql, bind);
	}

	execMany(sql: string[]) {
		return this.internal.execMany(sql);
	}

	execO<O extends Record<string, any>>(sql: string, bind: SQLiteCompatibleType[]) {
		return this.internal.execO(sql, bind) as Promise<O[]>;
	}

	execA<T extends any[]>(sql: string, bind: SQLiteCompatibleType[]) {
		return this.internal.execA(sql, bind) as Promise<T[]>;
	}

	close() {
		return this.internal.close();
	}

	createFunction(name: string, fn: (...args: any) => unknown, opts?: Record<string, any>) {
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
