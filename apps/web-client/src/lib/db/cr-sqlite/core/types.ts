import type { DBAsync, TXAsync as _TXAsync } from "@vlcn.io/xplat-api";
export type { DBAsync, StmtAsync, TMutex, UpdateType } from "@vlcn.io/xplat-api";

/**
 * A TXAsync type without the `tx.tx` method - we're using this adjusted type to ensure that functions
 * that call to `db.tx` don't accept `TXAsync` as `db` (ensuring we don't nest transactions).
 */
export type TXAsync = Omit<_TXAsync, "tx">;
export type { _TXAsync };

export type { VFSWhitelist } from "./vfs";

export type TXCallback = Parameters<DBAsync["tx"]>[0];
export type OnUpdateCallback = Parameters<DBAsync["onUpdate"]>[0];

export type SyncTransportOptions = {
	url: string;
	room: string;
	authToken?: string;
	pingInterval?: number;
	pingTimeout?: number;
};

export type SyncProgressPayload = {
	active: boolean;
	nProcessed: number;
	nTotal: number;
};

export type SyncStatusPayload = {
	ok: boolean;
	siteId?: string;
	schemaName?: string;
	schemaVersion?: string;
	schemaHash?: string;
	stage?: string;
	ackDbVersion?: number;
	reason?: string;
	message?: string;
};

export interface SyncWorkerBridge {
	startSync(dbid: string, transportOpts: SyncTransportOptions): Promise<void> | void;
	stopSync(dbid: string): Promise<void> | void;
	onChangesReceived(cb: (msg: { timestamp: number }) => void): () => void;
	onChangesProcessed(cb: (msg: { timestamp: number }) => void): () => void;
	onProgress(cb: (msg: SyncProgressPayload) => void): () => void;
	onOutgoingChanges(cb: (msg: { maxDbVersion: number; changeCount: number }) => void): () => void;
	onSyncStatus(cb: (msg: SyncStatusPayload) => void): () => void;
	onConnOpen(cb: () => void): () => void;
	onConnClose(cb: () => void): () => void;
	readonly isConnected: boolean;
}

export type DBAsyncSync = DBAsync & SyncWorkerBridge;

export function isSyncWorkerBridge(value: unknown): value is SyncWorkerBridge {
	if (!value || typeof value !== "object") return false;
	const candidate = value as Partial<SyncWorkerBridge>;
	return (
		typeof candidate.startSync === "function" &&
		typeof candidate.stopSync === "function" &&
		typeof candidate.onChangesReceived === "function" &&
		typeof candidate.onChangesProcessed === "function" &&
		typeof candidate.onProgress === "function" &&
		typeof candidate.onOutgoingChanges === "function" &&
		typeof candidate.onSyncStatus === "function" &&
		typeof candidate.onConnOpen === "function" &&
		typeof candidate.onConnClose === "function"
	);
}
