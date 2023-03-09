import { v4 as uuidv4 } from 'uuid';
import { derived, writable } from 'svelte/store';

// eslint-disable-next-line
export function createTable<T = Record<string, any>>({
	rows,
	onRowRemove = () => ({}),
	onRowAdd = () => ({})
}: CreateTableOptions<T>) {
	const data = writable(setRowKeys(rows));

	type KeyedRows = T & { key: string };
	let $data: KeyedRows[] = [];

	const selectedData = writable<KeyedRows[]>([]);

	const state = derived([data, selectedData], ([$data, $selectedData]) => {
		return {
			rows: $data,
			selected: $selectedData
		};
	});

	const addRows = (newRows: T[]) => {
		const keyednNewRows = setRowKeys(newRows);
		onRowAdd(keyednNewRows);
		data.update((rows) => [...rows, ...keyednNewRows]);
	};

	const removeRows = (selectedRows: KeyedRows[]) => {
		const selectedKeys = selectedRows.map(({ key }) => key);
		const filteredRows = $data.filter((r) => !selectedKeys.includes(r.key));

		onRowRemove(selectedRows);

		data.set(filteredRows);
		selectedData.set([]);
	};

	// eslint-disable-next-line
	const table = (node: HTMLTableElement) => {
		const unsubscribe = data.subscribe((values) => ($data = values));

		return {
			destroy() {
				unsubscribe();
			}
		};
	};

	const rowSelect = (
		node: HTMLTableRowElement,
		{
			on,
			handleSelect
		}: {
			on: keyof HTMLElementEventMap;
			handleSelect: (event: HTMLElementEventMap[typeof on], selected: typeof selectedData) => void;
		}
	) => {
		const onSelect = (event: HTMLElementEventMap[typeof on]) => {
			handleSelect(event, selectedData);
		};

		node.addEventListener(on, onSelect, true);

		return {
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
