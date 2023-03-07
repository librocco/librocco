import { writable, type Writable } from 'svelte/store';

import type { TableData } from './types';

interface CreateTableOptions {
	initialRows: TableData[];
	onRowRemove?: (selected: TableData[]) => void;
	onRowAdd?: (selected: TableData[]) => void;
}

// eslint-disable-next-line
export function createTable({ initialRows, onRowRemove = () => {}, onRowAdd = () => {} }: CreateTableOptions) {
	const data = writable(initialRows);
	const selected = writable<TableData[]>([]);

	let $data: TableData[] = [];

	const addRows = (newRows: TableData[]) => {
		onRowAdd(newRows);
		data.update((rows) => [...rows, ...newRows]);
	};
	const removeRows = (selectedRows: TableData[]) => {
		const selectedIsbns = selectedRows.map(({ isbn }) => isbn);
		const filteredRows = $data.filter((r) => !selectedIsbns.includes(r.isbn));

		onRowRemove(selectedRows);
		data.set(filteredRows);
		selected.set([]);
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
			handleSelect: (event: HTMLElementEventMap[typeof on], selected: Writable<TableData[]>) => void;
		}
	) => {
		const onSelect = (event: HTMLElementEventMap[typeof on]) => {
			handleSelect(event, selected);
		};

		node.addEventListener(on, onSelect, true);

		return {
			destroy() {
				node.removeEventListener(on, onSelect, true);
			}
		};
	};

	return {
		data,
		selected,
		table,
		addRows,
		removeRows,
		rowSelect
	};
}
