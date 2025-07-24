import type { VFSWhitelist } from "$lib/db/cr-sqlite/core";
import type { SyncProgress } from "./sync-transport-control";

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

export type MsgProgress = {
	_type: "progress";
	payload: SyncProgress;
};

export type MsgReady = {
	_type: "ready";
	payload: {};
};
