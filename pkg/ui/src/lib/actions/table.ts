import { v4 as uuidv4 } from 'uuid';
import { derived, writable, get } from 'svelte/store';
import type { Action } from 'svelte/action';

// eslint-disable-next-line
export function createTable<T = Record<string, any>>({
	rows,
	onRowRemove = () => ({}),
	onRowAdd = () => ({})
}: CreateTableOptions<T>) {
	/**
	 * Type extends generic table data T with unique `key`
	 */
	type KeyedRows = T & { key: string };

	/**
	 * Store of table rows with unique keyss
	 */
	const data = writable(setRowKeys(rows));

	/**
	 * Store of selected table rows
	 */
	const selectedData = writable<KeyedRows[]>([]);

	/**
	 * Derived store of table state - combinin data & selectedData stores
	 */
	const state = derived([data, selectedData], ([$data, $selectedData]) => {
		return {
			rows: $data,
			selected: $selectedData
		};
	});

	/**
	 * Helper adds rows to table data store
	 * @param newRows
	 */
	const addRows = (newRows: T[]) => {
		const keyednNewRows = setRowKeys(newRows);
		onRowAdd(keyednNewRows);
		data.update((rows) => [...rows, ...keyednNewRows]);
	};

	/**
	 * Helper removes rows from table data store & resets selected store
	 * @param selectedRows
	 */
	const removeRows = (selectedRows: KeyedRows[]) => {
		const selectedKeys = selectedRows.map(({ key }) => key);
		const filteredRows = get(data).filter((r) => !selectedKeys.includes(r.key));

		onRowRemove(selectedRows);

		data.set(filteredRows);
		selectedData.set([]);
	};

	/**
	 * Table action
	 */
	const table: Action<HTMLTableElement> = () => {
		return {
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
	const rowSelect = (
		node: HTMLTableRowElement,
		{
			on,
			handleSelect,
			position
		}: {
			on: keyof HTMLElementEventMap;
			handleSelect: (event: HTMLElementEventMap[typeof on], selected: typeof selectedData) => void;
			position?: number;
		}
	) => {
		const onSelect = (event: HTMLElementEventMap[typeof on]) => {
			handleSelect(event, selectedData);
		};

		node.addEventListener(on, onSelect, true);
		setAriaRowIndex(node, position);

		return {
			update({ position }: { position?: number }) {
				setAriaRowIndex(node, position);
			},
			destroy() {
				node.removeEventListener(on, onSelect, true);
			}
		};
	};

	return {
		subscribe: state.subscribe,
		table,
		addRows,
		removeRows,
		rowSelect
	};
}

/**
 * Table factory params
 */
interface CreateTableOptions<T> {
	rows: T[];
	onRowRemove?: (selected: T[]) => void;
	onRowAdd?: (selected: T[]) => void;
}

/**
 * Helper to add unique `key` to each row of data
 * @param rows
 * @returns
 */
function setRowKeys<T>(rows: T[]) {
	return rows.map((row) => ({ ...row, key: uuidv4() }));
}

/**
 * Helper to set `aria-rowindex`
 * @param node
 * @param position
 */
function setAriaRowIndex(node: HTMLElement, position: number | undefined) {
	if (position !== undefined) {
		node.setAttribute('aria-rowindex', `${position + 1}`);
	}
}
