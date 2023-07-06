/* eslint-disable @typescript-eslint/ban-types */
import { filter, map } from "./generators";
import { StockElement, StockEntry, VolumeStock, VolumeStockInput, VolumeStockMap } from "./types";

export class StockMap implements VolumeStockMap {
	#internal = new Map<string, StockElement>();

	// This gets overridden by the Object.defineProperty call inside the constructor
	// but is here to keep TypeScript happy
	readonly size = 0;

	constructor(source?: Iterable<StockEntry>) {
		// "Bind" the 'size' property to the internal map's 'size' property
		Object.defineProperty(this, "size", {
			get: () => this.#internal.size
		});

		if (source) {
			for (const [key, value] of source) {
				this.set(key, value);
			}
		}
	}

	static fromDbRows(rows: Iterable<VolumeStockInput>) {
		const map = new StockMap();
		map.aggragate(rows);
		return map;
	}

	// #region Map interface
	[Symbol.toStringTag] = "StockMap";

	[Symbol.iterator]() {
		const iterable = map(this.#internal, ([key, value]) => [key.split(":"), value] as [[string, string], StockElement]);
		return iterable[Symbol.iterator]();
	}

	keys() {
		const iterable = map(this.#internal.keys(), (key) => key.split(":") as [string, string]);
		return iterable[Symbol.iterator]();
	}

	values() {
		return this.#internal.values();
	}

	entries() {
		const iterable = map(this.#internal.entries(), ([key, value]) => [key.split(":"), value] as [[string, string], StockElement]);
		return iterable[Symbol.iterator]();
	}

	forEach(callbackfn: (value: StockElement, key: [string, string], map: Map<[string, string], StockElement>) => void) {
		for (const [key, value] of this) {
			callbackfn(value, key, this);
		}
	}

	set(key: [string, string], value: StockElement) {
		this.#internal.set(key.join(":"), value);
		return this;
	}

	get(key: [string, string]) {
		return this.#internal.get(key.join(":"));
	}

	has(key: [string, string]) {
		return this.#internal.has(key.join(":"));
	}

	delete(key: [string, string]) {
		const res = this.#internal.delete(key.join(":"));
		return res;
	}

	clear() {
		this.#internal.clear();
	}

	// #endregion Map interface

	// #region Additional methods
	aggragate(entries: Iterable<VolumeStockInput>) {
		for (const entry of entries) {
			// Skip entries with 0 quantity
			if (entry.quantity === 0) continue;

			const key = [entry.isbn, entry.warehouseId] as [string, string];
			const delta = entry.noteType === "inbound" ? entry.quantity : -entry.quantity;

			const current = this.get(key);
			if (current) {
				current.quantity += delta;
				// Remove an entry when the quantity reaches 0
				if (current.quantity === 0) {
					this.delete(key);
				}
			} else {
				this.set(key, { quantity: delta });
			}
		}

		return this;
	}

	rows(): Iterable<VolumeStock> {
		return map(this.entries(), ([[isbn, warehouseId], { quantity }]) => ({ isbn, warehouseId, quantity }));
	}

	warehouse(warehouseId: string) {
		return warehouseId.includes("0-all") ? this : new StockMap(filter(this, ([[, warehouseId_]]) => warehouseId === warehouseId_));
	}

	isbn(isbn: string) {
		return new StockMap(filter(this, ([[isbn_]]) => isbn === isbn_));
	}
	// #endregion Additional methods
}
