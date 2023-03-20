import { render, screen, waitFor } from '@testing-library/svelte';
import html from 'svelte-htm';
import { get } from 'svelte/store';
import { vi, expect, test, describe } from 'vitest';
import userEvent from '@testing-library/user-event';

import { createTable } from '../table';

import { rows } from './data';
import InventoryTable from '../InventoryTable.svelte';

describe('Manages row data:', () => {
	const table = createTable({ rows });

	test('Adds `key` and `rowIx` to each row', () => {
		const row1 = get(table).rows[0];

		expect(row1).toHaveProperty('key');
		expect(row1).toHaveProperty('rowIx');
	});

	test('Adds new rows', () => {
		table.addRows([rows[0]]);

		expect(get(table).rows.length).toEqual(4);
	});

	test('Removes rows', () => {
		table.removeRows(get(table).rows);

		expect(get(table).rows.length).toBe(0);
	});
});

describe('Table row action:', () => {
	const table = createTable({ rows });

	test('Sets the row aria-rowindex attribute', () => {
		render(
			html`
			<tr use:action=${(node: HTMLTableRowElement) => table.tableRow(node, { position: 0 })}></table>
		`
		);

		expect(screen.getByRole('row')).toHaveAttribute('aria-rowindex', `${1}`);
	});

	test('Manages select event & handler', async () => {
		const user = userEvent.setup();
		const handleSelectMock = vi.fn();

		render(
			html`
			<tr use:action=${(node: HTMLTableRowElement) =>
				table.tableRow(node, { on: 'click', handleSelect: handleSelectMock })}></table>
		`
		);

		const row = screen.getByRole('row');

		await user.click(row);

		expect(handleSelectMock).toHaveBeenCalledOnce();
	});
});

describe('Table action:', () => {
	test('Sets the table aria-rowcount attribute', async () => {
		const table = createTable({ rows });

		const initialRowCount = rows.length;

		render(
			html`
				<table
					use:action=${(node: HTMLTableElement) => table.table(node, { rowCount: initialRowCount })}
				></table>
			`
		);

		expect(screen.getByRole('table')).toHaveAttribute('aria-rowcount', `${initialRowCount}`);
	});
});

test("Updates aria-rowcount & aria-rowindex's when rows are added/removed", async () => {
	const table = createTable({ rows });

	render(html` <${InventoryTable} table=${table} /> `);

	const row2 = rows[1];
	// TODO: Fix table data row aria labels
	const row2Name = `${row2.isbn} Title: ${row2.title} Authors: ${row2.authors} Year: ${row2.year} ${row2.title} ${row2.authors} ${row2.quantity} ${row2.price} ${row2.year} ${row2.publisher}`;

	const dataRow2 = screen.getByRole('row', { name: row2Name });

	expect(screen.getByRole('table')).toHaveAttribute('aria-rowcount', '4');
	expect(dataRow2).toHaveAttribute('aria-rowindex', '3');

	// Remove data row 1
	const dataRow1 = get(table).rows[0];
	table.removeRows([dataRow1]);

	await waitFor(() => {
		expect(screen.getByRole('table')).toHaveAttribute('aria-rowcount', '3');

		const dataRow2 = screen.getByRole('row', { name: row2Name });

		// With data row 1 gone, row 2 should drop index by 1
		expect(dataRow2).toHaveAttribute('aria-rowindex', '2');
	});
});
