import type { OutOfStockTransaction } from "@librocco/db";

export interface DialogContent {
	onConfirm: (closeDialog: () => void) => void;
	title: string;
	description: string;
}

export const dialogTitle = {
	delete: (entity: string) => `Permenantly delete ${entity}?`,
	commitInbound: (entity: string) => `Commit inbound ${entity}?`,
	commitOutbound: (entity: string) => `Commit outbound ${entity}?`,
	reconcileOutbound: () => "Stock mismatch",
	editBook: () => "Edit book details",
	editWarehouse: () => "Update book details"
};

export const dialogDescription = {
	deleteNote: () => "Once you delete this note, you will not be able to access it again",
	deleteWarehouse: (bookCount: number) => `Once you delete this warehouse ${bookCount} books will be removed from your stock`,
	commitInbound: (bookCount: number, warehouseName: string) => `${bookCount} books will be added to ${warehouseName}`,
	commitOutbound: (bookCount: number) => `${bookCount} books will be removed from your stock`,
	reconcileOutbound: (invalidTransactions: OutOfStockTransaction[]) =>
		[
			"Some quantities of books are greater than the available stock for their respective warehouse.",
			"By confirming this action, the available stock will be updated to allow for the transactions to be committed.",
			"Please review the following transactions and confirm if you want to proceed:",
			...invalidTransactions.map(
				({ isbn, warehouseName, quantity, available }) =>
					`  isbn: ${isbn}, quantity: ${quantity} in ${warehouseName} (available: ${available})`
			)
		].join("\n"),
	editBook: () => "Update book details",
	editWarehouse: () => "Update warehouse details"
};
