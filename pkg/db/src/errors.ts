import { VolumeStock } from "@librocco/shared";

import type { OutOfStockTransaction } from "./types";

export class TransactionWarehouseMismatchError extends Error {
	parentWarehouse: string;
	invalidTransactions: VolumeStock<"book">[];

	constructor(parentWarehouse: string, invalidTransactions: VolumeStock<"book">[]) {
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

export class NoWarehouseSelectedError extends Error {
	invalidTransactions: VolumeStock<"book">[];

	constructor(invalidTransactions: VolumeStock<"book">[]) {
		const message = `Trying to commit a note containing transactions with no warehouse selected.
    Invalid transactions:
    ${invalidTransactions.map(({ isbn }) => `ISBN: '${isbn}'`).join(`
    `)}`;

		super(message);
		this.invalidTransactions = invalidTransactions;
	}
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
export class EmptyCustomerOrderError extends Error {
	constructor() {
		super("Trying to commit a customer order without books or an email");
	}
}

export class EmptyTransactionError extends Error {
	constructor() {
		super("Trying to enter an empty transaction");
	}
}
