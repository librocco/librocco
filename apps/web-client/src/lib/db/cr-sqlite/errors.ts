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

export class ErrDBCorrupted extends Error {
	constructor(message: string) {
		super(message);
		this.name = "ErrDBCorrupted";
	}
}

type ErrDBSchemaMismatchPayload = { wantName: string; wantVersion: bigint; gotName: string; gotVersion: bigint };
export class ErrDBSchemaMismatch extends Error {
	wantName: string;
	wantVersion: bigint;

	gotName: string;
	gotVersion: bigint;

	constructor({ wantName, wantVersion, gotName, gotVersion }: ErrDBSchemaMismatchPayload) {
		const message = [
			"DB name/schema mismatch:",
			`  req name: ${wantName}, got name: ${gotName}`,
			`  req version: ${wantVersion}, got version: ${gotVersion}`
		].join("\n");

		super(message);

		this.name = "ErrDBSchemaMismatch";

		this.wantName = wantName;
		this.wantVersion = wantVersion;

		this.gotName = gotName;
		this.gotVersion = gotVersion;
	}
}

export class ErrDemoDBNotInitialised extends Error {
	constructor() {
		super("Demo DB not initialised");
		this.name = "ErrDemoDBNotInitialised";
	}
}
