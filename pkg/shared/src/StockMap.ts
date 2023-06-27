/* eslint-disable @typescript-eslint/ban-types */
import { map } from "./generators";

type StockElement = { quantity: number };
type VolumeStockMap = Map<[string, string], StockElement>;

export class StockMap implements VolumeStockMap {
	#internal = new Map<string, StockElement>();

	// This gets overridden by the Object.defineProperty call inside the constructor
	// but is here to keep TypeScript happy
	readonly size = 0;

	constructor() {
		// "Bind" the 'size' property to the internal map's 'size' property
		Object.defineProperty(this, "size", {
			get: () => this.#internal.size
		});
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
}
