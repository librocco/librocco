import * as Comlink from "comlink";

import type { DBAsync, OnUpdateCallback, TXCallback, VFSWhitelist } from "./types";

import { getCrsqliteDB } from "./init";

export type MsgInitOk = { _type: "wkr-init"; status: "ok" };
export type MsgWkrError = { _type: "wkr-init"; status: "error"; error: string; stack?: string };
export type MsgInit = MsgInitOk | MsgWkrError;

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

/**
 * Wraps the DB instance with a (JS) Proxy, overriding certain methods for safe over-the-wire (Comlink) usage.
 */
function wrapDB(db: DBAsync): DBAsync {
	return new Proxy(db, {
		get(target: DBAsync, prop: keyof DBAsync, receiver) {
			switch (prop) {
				// NOTE: `db.onUpdate` returns a function (unsubscribe) that needs to be proxied (Comlink.proxy) when being
				// returned to the main thread.
				case "onUpdate": {
					return async (cb: OnUpdateCallback) => {
						const unsubscribe = Reflect.get(target, prop, receiver)(cb);
						return Comlink.proxy(unsubscribe);
					};
				}

				// NOTE: `db.tx` is called by passing the callback. When calling from the main thread, the callback needs to be
				// proxied (using Comlink.proxy). Furthermore, when calling the proxied callback (from worker to the main thread),
				// the first parameter (the TXAsync object) needs to be proxied back as well.
				case "tx": {
					return async (cb: TXCallback) => {
						// Adapt the 'cb' so that the first param (TXAsync) is proxied back when calling
						const adapt = (cb: TXCallback): TXCallback => {
							return (tx) => cb(Comlink.proxy(tx));
						};
						return Reflect.get(target, prop, receiver)(adapt(cb));
					};
				}

				// NOTE: `db.imperativeTx` returns releaser and TXAsync object, both of which need to be proxied.
				case "imperativeTx": {
					return async () => {
						const [releaser, tx] = await Reflect.get(target, prop, receiver)();
						return [Comlink.proxy(releaser), Comlink.proxy(tx)];
					};
				}

				default: {
					return Reflect.get(target, prop, receiver);
				}
			}
		},
		set(target, prop, value, receiver) {
			return Reflect.set(target, prop, value, receiver);
		}
	});
}
