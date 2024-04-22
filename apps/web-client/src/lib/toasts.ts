import { createToaster, ToastType, type ToastData } from "$lib/components";

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
