import { createToaster, ToastType, type ToastData } from "@librocco/ui";

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

export const noteToastMessages = (noteName, warehouseName = "all") => ({
	inNoteCreated: `${noteName} created in ${warehouseName}`,
	inNoteCommited: `${noteName} commited`,
	outNoteCreated: `${noteName} created`,
	outNoteCommited: `${noteName} commited to ${warehouseName}`,
	noteDeleted: `${noteName} deleted`,
	volumeAdded: (isbn) => `${isbn} added to ${noteName}`,
	volumeRemoved: (qtn) => `Removed ${qtn} book${qtn === 1 ? "" : "s"} from ${noteName}`,
	volumeUpdated: (isbn) => `${isbn} quantitiy updated`
});

export const warehouseToastMessages = (warehouseName) => ({
	warehouseCreated: `${warehouseName} created`
});

const replicationStatusMessages = {
	INIT: () => toastSuccess("Connecting to remote database"),
	ACTIVE: () => toastSuccess("Syncing with database"),
	COMPLETED: () => toastSuccess("Sync complete"),
	"PAUSED:IDLE": () => toastSuccess("Sync up to date. Waiting for changes..."),
	"FAILED:CANCEL": () => toastError("Sync cancelled. Closing connection"),
	"FAILED:ERROR": () => toastError("Sync error. Closing connection"),
	"PAUSED:ERROR": () => toastError("Sync error. Retrying...")
};

export const toastReplicationStatus = (state: ReplicationState) => replicationStatusMessages[state]();
