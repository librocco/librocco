import { writable, type Writable } from 'svelte/store';

import type { TableData } from './types';

export function createTable(initialRows: TableData[]) {
	const data = writable(initialRows);
	const selected = writable<TableData[]>([]);

	const addRow = (store: Writable<TableData[]>) => (row: TableData) => {
		store.update((rows) => [...rows, row]);
	};

	const removeRow = (store: Writable<TableData[]>) => (row: TableData) => {
		store.update((rows) => rows.filter((r) => r.isbn !== row.isbn));
	};

	const table = () => {
		return {
			destroy() {
				return;
			}
		};
	};

	const tableHeaderRow = (node: HTMLTableRowElement, rowData: TableData[]) => {
		const handleSelect = (event: HTMLElementEventMap['change']) => {
			const isSelected = (event?.target as HTMLInputElement)?.checked;

			if (isSelected) {
				selected.set(rowData);
			} else {
				selected.set([]);
			}
		};

		node.addEventListener('change', handleSelect, true);

		return {
			destroy() {
				node.removeEventListener('change', handleSelect, true);
			}
		};
	};

	const tableRow = (node: HTMLTableRowElement, rowData: TableData) => {
		const handleSelect = (event: HTMLElementEventMap['change']) => {
			const isSelected = (event?.target as HTMLInputElement)?.checked;

			if (isSelected) {
				addRow(selected)(rowData);
			} else {
				removeRow(selected)(rowData);
			}
		};

		node.addEventListener('change', handleSelect, true);

		return {
			destroy() {
				node.removeEventListener('change', handleSelect, true);
			}
		};
	};

	return {
		data,
		selected,
		addRow: addRow(data),
		removeRow: removeRow(data),
		table,
		tableHeaderRow,
		tableRow
	};
}
