import type { VFSWhitelist } from "$lib/db/cr-sqlite/core";
import type { ProgressState } from "$lib/types";

// Client -> Worker

export type MsgStart = {
	_type: "start";
	payload: {
		vfs: VFSWhitelist;
	};
};

// Worker -> Client

export type MsgChangesReceived = {
	_type: "changesReceived";
	payload: { timestamp: number };
};

export type MsgChangesProcessed = {
	_type: "changesProcessed";
	payload: { timestamp: number };
};

export type MsgOutgoingChanges = {
	_type: "outgoingChanges";
	payload: { maxDbVersion: number; changeCount: number };
};

export type MsgSyncStatus = {
	_type: "sync.status";
	payload: { ok: boolean; siteId?: string; schemaName?: string; schemaVersion?: string; stage?: string; reason?: string; message?: string };
};

export type MsgProgress = {
	_type: "progress";
	payload: ProgressState;
};

export type MsgReady = {
	_type: "ready";
	payload: null;
};

export type MsgConnectionOpen = {
	_type: "connection.open";
	payload: null;
};

export type MsgConnectionClose = {
	_type: "connection.close";
	payload: null;
};
