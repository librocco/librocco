import { render } from "@testing-library/svelte";
import { writable, get } from "svelte/store";
import { vi, expect, test, describe } from "vitest";
import { page } from "@vitest/browser/context";

import { createTable } from "../table";

import { StockTable } from "$lib/components";
import TableRowHarness from "./TableRowHarness.svelte";
import TableHarness from "./TableHarness.svelte";

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

	test("Sets the row aria-rowindex attribute", async () => {
		const { container } = render(TableRowHarness, {
			action: (node: HTMLTableRowElement) => table.tableRow(node, { position: 0 })
		});

		const row = page.elementLocator(container).getByRole("row");

		await expect.element(row).toBeInTheDocument();
		await expect.element(row).toHaveAttribute("aria-rowindex", "1");
	});

	test("Manages select event & handler", async () => {
		const handleSelectMock = vi.fn();

		const { container } = render(TableRowHarness, {
			action: (node: HTMLTableRowElement) => table.tableRow(node, { on: "click", handleSelect: handleSelectMock })
		});

		const row = page.elementLocator(container).getByRole("row");

		await expect.element(row).toBeInTheDocument();

		(row.element() as HTMLElement).click();

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

		const { container } = render(TableHarness, {
			action: (node: HTMLTableElement) => table.table(node, { rowCount: initialRowCount }) as NonNullable<ReturnType<typeof table.table>>
		});

		const tableEl = page.elementLocator(container).getByRole("table");

		await expect.element(tableEl).toBeInTheDocument();
		await expect.element(tableEl).toHaveAttribute("aria-rowcount", `${initialRowCount}`);
	});
});

test("Updates aria-rowcount & aria-rowindex's when rows are added/removed", async () => {
	const tableOptions = writable({
		data: rows
	});
	const table = createTable(tableOptions);

	const { container } = render(StockTable, { table });

	const tableEl = page.elementLocator(container).getByRole("table");
	await expect.element(tableEl).toBeInTheDocument();
	await expect.element(tableEl).toHaveAttribute("aria-rowcount", "4");

	const tbody = container.querySelector("tbody")!;
	const row = page.elementLocator(tbody).getByRole("row");

	// Check row 2 (rows[1]):
	await expect.element(row.nth(1)).toHaveAttribute("aria-rowindex", "2");
	await expect.element(row.nth(1)).toHaveTextContent(rows[1].isbn);

	// Remove data row 1
	tableOptions.update(({ data }) => ({ data: data.slice(1) }));

	// Wait for reactive updates
	await new Promise((resolve) => setTimeout(resolve, 100));

	// Re-query the table element after update
	const updatedTableEl = page.elementLocator(container).getByRole("table");
	await expect.element(updatedTableEl).toHaveAttribute("aria-rowcount", "3");

	// After removing first row, what was row 2 should now be row 1
	// Row 1 shows data for rows[1]
	await expect.element(row.nth(0)).toHaveAttribute("aria-rowindex", "1");
	await expect.element(row.nth(0)).toHaveTextContent(rows[1].isbn);
});
