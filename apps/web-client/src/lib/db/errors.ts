import type { VolumeStock, OutOfStockTransaction } from "./types";

export class NoWarehouseSelectedError extends Error {
	invalidTransactions: VolumeStock[];

	constructor(invalidTransactions: VolumeStock[]) {
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
