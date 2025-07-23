import { type Config, type DB, defaultConfig } from "@vlcn.io/ws-client";
import { start } from "@vlcn.io/ws-client/worker.js";
import { firstPick } from "@vlcn.io/xplat-api";
import { WrappedDB } from "@vlcn.io/ws-browserdb";

// Interface to WASM sqlite
import wasmUrl from "@vlcn.io/crsqlite-wasm/crsqlite.wasm?url";

import { initWasm } from "$lib/db/cr-sqlite/opfs";

import { SyncTransportController, SyncEventEmitter } from "./sync-transport-control";
import type { SyncConfig } from "./sync-transport-control";

// Emitter object
// - emits sync events to the main thread
// - used to monitor the sync state/progress
const progressEmitter = new SyncEventEmitter();

// Propagate messages from the sync process to the main thread
progressEmitter.onChangesReceived((payload) => {
	self.postMessage({ _type: "changesReceived", payload });
});
progressEmitter.onChangesProcessed((payload) => {
	self.postMessage({ _type: "changesProcessed", payload });
});
progressEmitter.onProgress((payload) => {
	self.postMessage({ _type: "progress", payload });
});

const maxChunkSize = 1024;

const config: Config = {
	dbProvider: createDbProvider(wasmUrl),
	transportProvider: wrapTransportProvider(defaultConfig.transportProvider, progressEmitter, { maxChunkSize })
};

// Start the sync process
start(config);

self.postMessage("ready");

type TransportProvider = Config["transportProvider"];

/**
 * See `wrapTransport` above. This merely wraps the transport provider (rather than transport itself), to
 * fit the signature (shape of the config) passed to the sync service `start` function.
 */
function wrapTransportProvider(provider: TransportProvider, emitter: SyncEventEmitter, config: SyncConfig): TransportProvider {
	return (...params: Parameters<TransportProvider>) => new SyncTransportController(provider(...params), emitter, config);
}

/**
 * A copy of `createDbProvider` from `ws-browserdb`, but slightly refactored to use our `initWasm` with `opfs-any-context-vfs` adapter
 */
function createDbProvider(wasmUri?: string): (dbname: string) => PromiseLike<DB> {
	return async (dbname: string): Promise<DB> => {
		const sqlite = await initWasm(wasmUri ? () => wasmUri : undefined);
		const db = await sqlite.open(dbname, "c", "opfs-any-context-vfs");

		const [pullChangesetStmt, applyChangesetStmt, updatePeerTrackerStmt] = await Promise.all([
			db.prepare(
				`SELECT "table", "pk", "cid", "val", "col_version", "db_version", NULL, "cl", seq FROM crsql_changes WHERE db_version > ? AND site_id IS NOT ?`
			),
			db.prepare(
				`INSERT INTO crsql_changes ("table", "pk", "cid", "val", "col_version", "db_version", "site_id", "cl", "seq") VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
			),
			db.prepare(
				`INSERT INTO "crsql_tracked_peers" ("site_id", "event", "version", "seq", "tag") VALUES (?, ?, ?, ?, 0) ON CONFLICT DO UPDATE SET
          "version" = MAX("version", excluded."version"),
          "seq" = CASE "version" > excluded."version" WHEN 1 THEN "seq" ELSE excluded."seq" END`
			)
		]);
		pullChangesetStmt.raw(true);

		const siteid = (await db.execA<[Uint8Array]>(`SELECT crsql_site_id()`))[0][0];

		const schemaName = firstPick<string>(await db.execA<[string]>(`SELECT value FROM crsql_master WHERE key = 'schema_name'`));
		if (schemaName == null) {
			throw new Error("The database does not have a schema applied.");
		}
		const schemaVersion = BigInt(
			firstPick<number | bigint>(await db.execA<[number | bigint]>(`SELECT value FROM crsql_master WHERE key = 'schema_version'`)) || -1
		);

		return new WrappedDB(db, siteid, schemaName, schemaVersion, pullChangesetStmt, applyChangesetStmt, updatePeerTrackerStmt);
	};
}
