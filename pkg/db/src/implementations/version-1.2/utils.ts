import { EntriesStreamResult, NavListEntry, VolumeStock, VolumeStockClient } from "@/types";

import { versionId } from "@/utils/misc";

export const combineTransactionsWarehouses =
	({ includeAvailableWarehouses }: { includeAvailableWarehouses: boolean }) =>
	([entries, stats, warehouses]: [VolumeStock[], { total: number; totalPages: number }, NavListEntry[]]): EntriesStreamResult => {
		// Create a record of warehouse ids and names for easy lookup
		const warehouseNames = warehouses.reduce(
			(acc, { id, displayName }) => ({ ...acc, [id]: displayName }),
			{} as Record<string, string>
		);

		const warehouseSelection = Object.entries(warehouseNames)
			.filter(([id]) => id !== versionId("0-all"))
			.map(([value, label]) => ({ value, label }));

		const rows = entries.map((e) => {
			const entry = { ...e } as VolumeStockClient;

			entry.warehouseName = warehouseNames[e.warehouseId] || "not-found";

			if (includeAvailableWarehouses) {
				entry.availableWarehouses = warehouseSelection;
			}

			return entry;
		});

		return { ...stats, rows };
	};

export type IterableTransformer<T, R> = (iterable: Iterable<T>) => Iterable<R>;
export type Reducer<T, R> = (iterable: Iterable<T>) => R;

export function* filter<T>(iterable: Iterable<T>, cb: (v: T) => boolean): Iterable<T> {
	for (const v of iterable) {
		if (cb(v)) {
			yield v;
		}
	}
}

export function* map<T, R>(iterable: Iterable<T>, cb: (v: T) => R): Iterable<R> {
	for (const v of iterable) {
		yield cb(v);
	}
}

export function* flatMap<T, R>(iterable: Iterable<T>, cb: (v: T) => Iterable<R>): Iterable<R> {
	for (const v of iterable) {
		yield* cb(v);
	}
}

export function reduce<T>(iterable: Iterable<T>, cb: (acc: T, curr: T) => T, seed?: T): T;
export function reduce<T, R>(iterable: Iterable<T>, cb: (acc: R, curr: T) => R, seed: R): R;
export function reduce<T, R>(iterable: Iterable<T>, cb: (acc: R, curr: T) => R, seed?: R): R {
	const iterator = iterable[Symbol.iterator]();

	let acc = seed || iterator.next().value;

	// eslint-disable-next-line no-constant-condition
	while (true) {
		const curr = iterator.next();
		if (curr.done && curr.value === undefined) {
			break;
		}
		acc = cb(acc, curr.value);
	}

	return acc;
}
