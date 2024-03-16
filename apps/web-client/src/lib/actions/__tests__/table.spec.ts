import { render, screen, waitFor } from "@testing-library/svelte";
import html from "svelte-htm";
import { writable, get } from "svelte/store";
import { vi, expect, test, describe } from "vitest";
import userEvent from "@testing-library/user-event";

import { createTable } from "../table";

import { StockTable } from "$lib/components";

import { rows } from "$lib/__testData__/rowData";

describe("Manages row data:", () => {
	const tableOptions = writable({
		data: rows
	});

	const table = createTable(tableOptions);

	test("Adds `key` and `rowIx` to each row", () => {
		const row1 = get(table).rows[0];

		expect(row1).toHaveProperty("key");
		expect(row1).toHaveProperty("rowIx");
	});

	test("Adds new rows", () => {
		tableOptions.update(({ data }) => ({ data: [...data, rows[0]] }));

		expect(get(table).rows.length).toEqual(4);
	});

	test("Removes rows", () => {
		tableOptions.set({ data: [] });

		expect(get(table).rows.length).toBe(0);
	});
});

describe("Table row action:", () => {
	const tableOptions = writable({
		data: rows
	});

	const table = createTable(tableOptions);

	test("Sets the row aria-rowindex attribute", () => {
		render(
			html`
			<tr use:action=${(node: HTMLTableRowElement) => table.tableRow(node, { position: 0 })}></table>
		`
		);

		// TODO: Fix types (jest matchers - installed, but, for some reason, not picked up by TS)
		// eslint-disable-next-line @typescript-eslint/ban-ts-comment
		// @ts-ignore
		expect(screen.getByRole("row")).toHaveAttribute("aria-rowindex", `${1}`);
	});

	test("Manages select event & handler", async () => {
		const user = userEvent.setup();
		const handleSelectMock = vi.fn();

		render(
			html`
			<tr use:action=${(node: HTMLTableRowElement) => table.tableRow(node, { on: "click", handleSelect: handleSelectMock })}></table>
		`
		);

		const row = screen.getByRole("row");

		await user.click(row);

		expect(handleSelectMock).toHaveBeenCalledOnce();
	});
});

describe("Table action:", () => {
	test("Sets the table aria-rowcount attribute", async () => {
		const tableOptions = writable({
			data: rows
		});

		const table = createTable(tableOptions);

		const initialRowCount = rows.length;

		render(html` <table use:action=${(node: HTMLTableElement) => table.table(node, { rowCount: initialRowCount })}></table> `);

		// TODO: Fix types (jest matchers - installed, but, for some reason, not picked up by TS)
		// eslint-disable-next-line @typescript-eslint/ban-ts-comment
		// @ts-ignore
		expect(screen.getByRole("table")).toHaveAttribute("aria-rowcount", `${initialRowCount}`);
	});
});

test("Updates aria-rowcount & aria-rowindex's when rows are added/removed", async () => {
	const tableOptions = writable({
		data: rows
	});

	const table = createTable(tableOptions);

	render(html` <${StockTable} interactive table=${table} /> `);

	const row2 = rows[1];

	// TODO: This is a pain to fix aany time there is a slight update to the table, and it looks terribly inaccessible
	// 917289012381 title: Hellenistic history and culture authors: Peter Green year: 2017 Hellenistic history and culture Peter Green Discounted price: €99.90 Original price: (€100) Percentage discount: -10% 3 Penguin 2017
	const row2Name = `${row2.isbn} title: ${row2.title} authors: ${row2.authors} year: ${row2.year} ${row2.title} ${
		row2.authors
	} Discounted price: €${Math.round(row2.price * (100 - row2.warehouseDiscount)) / 100} Original price: (€${
		row2.price
	}) Percentage discount: -${row2.warehouseDiscount}% ${row2.quantity} ${row2.publisher} ${row2.year}`;

	const dataRow2 = screen.getByRole("row", { name: row2Name });

	// TODO: Fix types (jest matchers - installed, but, for some reason, not picked up by TS)
	// eslint-disable-next-line @typescript-eslint/ban-ts-comment
	// @ts-ignore
	expect(screen.getByRole("table")).toHaveAttribute("aria-rowcount", "4");
	// TODO: Fix types (jest matchers - installed, but, for some reason, not picked up by TS)
	// eslint-disable-next-line @typescript-eslint/ban-ts-comment
	// @ts-ignore
	expect(dataRow2).toHaveAttribute("aria-rowindex", "2");

	// Remove data row 1
	const dataRow1 = get(table).rows[0];

	tableOptions.update(({ data }) => {
		const filtered = data.filter((row) => row.isbn !== dataRow1.isbn);

		return { data: filtered };
	});

	await waitFor(() => {
		// TODO: Fix types (jest matchers - installed, but, for some reason, not picked up by TS)
		// eslint-disable-next-line @typescript-eslint/ban-ts-comment
		// @ts-ignore
		expect(screen.getByRole("table")).toHaveAttribute("aria-rowcount", "3");

		const dataRow2 = screen.getByRole("row", { name: row2Name });

		// With data row 1 gone, row 2 should drop index by 1
		//
		// TODO: Fix types (jest matchers - installed, but, for some reason, not picked up by TS)
		// eslint-disable-next-line @typescript-eslint/ban-ts-comment
		// @ts-ignore
		expect(dataRow2).toHaveAttribute("aria-rowindex", "1");
	});
});
