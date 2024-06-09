/* eslint-disable @typescript-eslint/ban-types */
import { filter, map } from "./generators";
import { VolumeStock } from "./types";

/**
 * Input for VolumeStockMap, used to aggregate the transactions and calculate stock.
 *
 * _note: only valid inputs are book-related rows as custom rows are not used in stock calculations (used only as rows in particular notes)._
 */
export type VolumeStockInput = VolumeStock<"book"> & { noteType: "inbound" | "outbound" };

export type StockKey = [isbn: string, warehouseId: string];
export type StockElement = { quantity: number };
export type StockEntry = [StockKey, StockElement];

/**
 * Extends the regular JavaScript Map, used to house stock data.
 *
 * @key [isbn, warehouseId]
 * Unlike the regular Map, the key is a tuple of [isbn, warehouseId]. Unlike in the regular Map, any two combination the same [isbn, warehouseId]
 * will be treated as the same key, and are guaranteed to access the same element.
 *
 * @element { quantity: number }
 */
export class StockMap implements Map<StockKey, StockElement> {
	#internal = new Map<string, StockElement>();

	// This gets overridden by the Object.defineProperty call inside the constructor
	// but is here to keep TypeScript happy
	readonly size = 0;

	/**
	 * @param source iterable of { [isbn, warehouseId] => { quantity } } used to seed the map
	 */
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

	/**
	 * Creates a new StockMap from VolumeStock rows (with denoted note type)
	 * @param rows
	 * @returns
	 */
	static fromDbRows(rows: Iterable<VolumeStockInput>) {
		const map = new StockMap();
		map.aggregate(rows);
		return map;
	}

	// #region Map interface
	[Symbol.toStringTag] = "StockMap";

	[Symbol.iterator]() {
		const iterable = map(this.#internal, ([key, value]) => [key.split(":"), value] as [[string, string], StockElement]);
		return iterable[Symbol.iterator]();
	}

	/**
	 * Returns an iterable for VolumeStockMap keys: `[isbn, warehouseId]` tuples.
	 */
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

	/**
	 * Map.set()
	 * @param key `[isbn: string, warehouseId: string]` - passed by value
	 * @returns
	 */
	set(key: [string, string], value: StockElement) {
		this.#internal.set(key.join(":"), value);
		return this;
	}

	/**
	 * Map.get()
	 * @param key `[isbn: string, warehouseId: string]` - passed by value
	 * @returns
	 */
	get(key: [string, string]) {
		return this.#internal.get(key.join(":"));
	}

	/**
	 * Map.has()
	 * @param key `[isbn: string, warehouseId: string]` - passed by value
	 * @returns
	 */
	has(key: [string, string]) {
		return this.#internal.has(key.join(":"));
	}

	/**
	 * Map.delete()
	 * @param key `[isbn: string, warehouseId: string]` - passed by value
	 * @returns
	 */
	delete(key: [string, string]) {
		const res = this.#internal.delete(key.join(":"));
		return res;
	}

	/**
	 * @param key `[isbn: string, warehouseId: string]` - passed by value
	 * @returns quantity of the stock element, or 0 if the element does not exist
	 */
	getQuantity(key: [string, string]) {
		return this.get(key)?.quantity || 0;
	}

	clear() {
		this.#internal.clear();
	}

	// #endregion Map interface

	// #region Additional methods
	/**
	 * Aggregates the entries into the stock.
	 * @param entries
	 * @returns
	 */
	aggregate(entries: Iterable<VolumeStockInput>) {
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

	/**
	 * @returns an iterable over elements as `VolumeStock` rows
	 */
	rows(): Iterable<VolumeStock> {
		return map(this.entries(), ([[isbn, warehouseId], { quantity }]) => ({ isbn, warehouseId, quantity }));
	}

	/**
	 * @param warehouseId
	 * @returns a new StockMap with only the entries from the specified warehouse
	 */
	warehouse(warehouseId: string) {
		return warehouseId.includes("0-all") ? this : new StockMap(filter(this, ([[, warehouseId_]]) => warehouseId === warehouseId_));
	}

	/**
	 *
	 * @param isbn
	 * @returns a new StockMap with only the entries with the specified ISBN
	 */
	isbn(isbn: string) {
		return new StockMap(filter(this, ([[isbn_]]) => isbn === isbn_));
	}
	// #endregion Additional methods
}
