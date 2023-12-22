import { createToaster, ToastType, type ToastData, BadgeColor } from "@librocco/ui";

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
	volumeUpdated: (isbn: string) => `${isbn} quantitiy updated`
});

export const warehouseToastMessages = (warehouseName) => ({
	warehouseCreated: `${warehouseName} created`,
	warehouseUpdated: `${warehouseName} updated`,
	warehouseDeleted: `${warehouseName} deleted`,
	bookDataUpdated: (isbn: string) => `Updated book data for '${isbn}'`
});

// Aliging with BadgeColor enum here as it this color+message combo is used in the RemoteDb Description List
export const replicationStatusMessages = {
	INIT: { color: BadgeColor.Success, message: "Connecting to remote database" },
	"ACTIVE:REPLICATING": { color: BadgeColor.Success, message: "Syncing with database" },
	"ACTIVE:INDEXING": { color: BadgeColor.Success, message: "Building indices" },
	COMPLETED: { color: BadgeColor.Success, message: "Sync complete" },
	PAUSED: { color: BadgeColor.Warning, message: "Sync paused. Status unknown" },
	"PAUSED:IDLE": { color: BadgeColor.Success, message: "Sync is up-to-date. Waiting for changes..." },
	"FAILED:CANCEL": { color: BadgeColor.Error, message: "Sync cancelled. Connection closed" },
	"FAILED:ERROR": { color: BadgeColor.Error, message: "Sync error. Connection closed" },
	"PAUSED:ERROR": { color: BadgeColor.Error, message: "Sync error. Retrying..." }
};

export const toastReplicationStatus = (state: ReplicationState) => {
	const { color, message } = replicationStatusMessages[state];

	const toastFn = color === BadgeColor.Success ? toastSuccess : color === BadgeColor.Error ? toastError : toastWarning;

	return toastFn(message);
};
