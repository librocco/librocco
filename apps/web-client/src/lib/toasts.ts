import { createToaster, ToastType } from "@librocco/ui";

export const defaultToaster = createToaster();

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
