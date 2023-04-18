import { VolumeStock } from "./types";

export class TransactionWarehouseMismatchError extends Error {
	parentWarehouse: string;
	invalidTransactions: Omit<VolumeStock, "quantity">[];

	constructor(parentWarehouse: string, invalidTransactions: Omit<VolumeStock, "quantity">[]) {
		const message = `Trying to commit a note containing transactions belonging to a different warehouse than the note itself.
    Note's parent warehouse: '${parentWarehouse}'
    Invalid transactions:
    ${invalidTransactions.map(({ isbn, warehouseId }) => `ISBN: '${isbn}', warehouse: '${warehouseId}'`).join(`
    `)}`;

		super(message);
		this.parentWarehouse = parentWarehouse;
		this.invalidTransactions = invalidTransactions;
	}
}

interface OutOfStockTransaction extends VolumeStock {
	available: number;
}
export class OutOfStockError extends Error {
	invalidTransactions: OutOfStockTransaction[];

	constructor(invalidTransactions: OutOfStockTransaction[]) {
		const message = `Trying to commit a note containing transactions that would result in a negative stock.
        Invalid transactions:
        ${invalidTransactions.map(
			({ isbn, warehouseId, quantity, available }) =>
				`ISBN: '${isbn}', warehouse: '${warehouseId}', quantity: ${quantity}, available in warehouse: ${available}`
		).join(`
        `)}`;

		super(message);
		this.invalidTransactions = invalidTransactions;
	}
}

export class EmptyNoteError extends Error {
	constructor() {
		super("Trying to commit an empty note");
	}
}

export class EmptyTransactionError extends Error {
	constructor() {
		super("Trying to emter an empty transaction");
	}
}
