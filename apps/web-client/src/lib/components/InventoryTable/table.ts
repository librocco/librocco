import { v4 as uuidv4 } from "uuid";
import type { Action } from "svelte/action";
import { derived, writable, type Writable } from "svelte/store";

/**
 * Table factory options
 */
interface TableOptions<T> {
	data: T[];
}

type WritableOrValue<T> = T | Writable<T>;

type Options<T> = WritableOrValue<TableOptions<T>>;

// eslint-disable-next-line
export function createTable<T = object>(options: Options<T>) {
	let optionsStore: Writable<TableOptions<T>>;

	if ("subscribe" in options) {
		optionsStore = options;
	} else {
		optionsStore = writable(options);
	}

	/**
	 * Type extends generic table data T with unique `key` and `rowIx`
	 */
	type KeyedRow = T & { key: string; rowIx: number };

	/**
	 * Store of table rows with unique keys & rowIx
	 */
	// const _data = writable(setRowKeys(rows));
	const data = derived(optionsStore, ($options) => {
		const { data = [] } = $options;
		return data.map((row) => ({ ...row, key: uuidv4() })).map((row, ix) => ({ ...row, rowIx: ix }));
	});

	/**
	 * Store of selected table rows
	 */
	const selectedData = writable<KeyedRow[]>([]);

	/**
	 * Derived store of table state - combining data & selectedData stores
	 */
	const state = derived([data, selectedData], ([$data, $selectedData]) => {
		return {
			rows: $data,
			selected: $selectedData
		};
	});

	/**
	 * Helper to reset selected store
	 */
	const resetRowSelection = () => selectedData.set([]);

	/**
	 * Table action
	 */
	const table: Action<HTMLTableElement, any> = (node, { rowCount }: { rowCount: number }) => {
		node.setAttribute("aria-rowcount", `${rowCount}`);

		return {
			// Update row-count if rows length changes
			update({ rowCount }: { rowCount: number }) {
				node.setAttribute("aria-rowcount", `${rowCount}`);
			},
			destroy() {
				return;
			}
		};
	};

	/**
	 * Row select action:
	 * - Manages an event listener which handles row selection; can be defined on any event
	 * - Manages row `aria-rowindex`
	 */
	const tableRow = (
		node: HTMLTableRowElement,
		{
			on = "click",
			handleSelect = () => ({}),
			position
		}: {
			on?: keyof HTMLElementEventMap;
			handleSelect?: (event: HTMLElementEventMap[typeof on], selected: typeof selectedData) => void;
			position?: number;
		} = {}
	) => {
		const onSelect = (event: HTMLElementEventMap[typeof on]) => {
			handleSelect(event, selectedData);
		};

		node.addEventListener(on, onSelect, true);

		if (position !== undefined) {
			// rows array is xero indexed while aria rowIx's start at 1
			// https://www.w3.org/WAI/ARIA/apg/practices/grid-and-table-properties/#usingaria-rowcountandaria-rowindex
			node.setAttribute("aria-rowindex", `${position + 1}`);
		}

		return {
			// Update row-index if position changes
			update({ position }: { position?: number }) {
				if (position !== undefined) {
					node.setAttribute("aria-rowindex", `${position + 1}`);
				}
			},
			destroy() {
				node.removeEventListener(on, onSelect, true);
			}
		};
	};

	return {
		subscribe: state.subscribe,
		table,
		resetRowSelection,
		tableRow
	};
}
