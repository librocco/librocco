import { createToaster, ToastType, type ToastData } from "@librocco/ui";

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

export const noteToastMessages = (noteName: string, warehouseName = "all") => ({
	inNoteCreated: `${noteName} created in ${warehouseName}`,
	inNoteCommited: `${noteName} commited`,
	outNoteCreated: `${noteName} created`,
	outNoteCommited: `${noteName} commited to ${warehouseName}`,
	noteDeleted: `${noteName} deleted`,
	bookDataUpdated: (isbn: string) => `Updated book data for '${isbn}'`,
	volumeAdded: (isbn: string) => `${isbn} added to ${noteName}`,
	volumeRemoved: (qtn: number) => `Removed ${qtn} book${qtn === 1 ? "" : "s"} from ${noteName}`,
	volumeUpdated: (isbn: string) => `${isbn} quantitiy updated`
});

export const warehouseToastMessages = (warehouseName) => ({
	warehouseCreated: `${warehouseName} created`,
	bookDataUpdated: (isbn: string) => `Updated book data for '${isbn}'`
});
