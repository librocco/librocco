import { createToaster, ToastType, type ToastData } from "$lib/components";

import type { ReplicationState } from "./stores/replication";

export const defaultToaster = createToaster<ToastData>();

export const toastSuccess = (message) =>
	defaultToaster.push({
		duration: 2000,
		pausable: true,
		type: ToastType.Success,
		message
	});

export const toastError = (message) =>
	defaultToaster.push({
		duration: 2000,
		pausable: true,
		type: ToastType.Error,
		message
	});

export const toastWarning = (message) =>
	defaultToaster.push({
		duration: 2000,
		pausable: true,
		type: ToastType.Warning,
		message
	});

export const noteToastMessages = (noteName: string, warehouseName = "all") => ({
	inNoteCreated: `${noteName} created in ${warehouseName}`,
	inNoteCommited: `${noteName} commited`,
	outNoteCreated: `${noteName} created`,
	outNoteCommited: `${noteName} commited to ${warehouseName}`,
	noteDeleted: `${noteName} deleted`,
	bookDataUpdated: (isbn: string) => `Updated book data for '${isbn}'`,
	volumeAdded: (isbn: string) => `${isbn} added to ${noteName}`,
	bookDataFetched: (isbn: string) => `${isbn} book data found`,
	volumeRemoved: (qtn: number) => `Removed ${qtn} book${qtn === 1 ? "" : "s"} from ${noteName}`,
	volumeUpdated: (isbn: string) => `${isbn} quantity updated`,
	warehouseUpdated: (isbn: string) => `${isbn} warehouse updated`
});

export const warehouseToastMessages = (warehouseName) => ({
	warehouseCreated: `${warehouseName} created`,
	warehouseUpdated: `${warehouseName} updated`,
	warehouseDeleted: `${warehouseName} deleted`,
	bookDataUpdated: (isbn: string) => `Updated book data for '${isbn}'`
});

export const bookFetchingMessages = {
	bookFound: "Book data found",
	bookNotFound: "Book data could not be found"
};
// Aliging with BadgeColor enum here as it this color+message combo is used in the RemoteDb Description List
export const replicationStatusMessages = {
	INIT: { state: "success", message: "Connecting to remote database" },
	"ACTIVE:REPLICATING": { state: "success", message: "Syncing with database" },
	"ACTIVE:INDEXING": { state: "success", message: "Building indices" },
	COMPLETED: { state: "success", message: "Sync complete" },
	PAUSED: { state: "warning", message: "Sync paused. Status unknown" },
	"PAUSED:IDLE": { state: "success", message: "Sync is up-to-date. Waiting for changes..." },
	"FAILED:CANCEL": { state: "error", message: "Sync cancelled. Connection closed" },
	"FAILED:ERROR": { state: "error", message: "Sync error. Connection closed" },
	"PAUSED:ERROR": { state: "error", message: "Sync error. Retrying..." }
} as const;

export const toastReplicationStatus = (status: ReplicationState) => {
	const { state, message } = replicationStatusMessages[status];

	const toastFn = state === "success" ? toastSuccess : state === "error" ? toastError : toastWarning;

	return toastFn(message);
};
