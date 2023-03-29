import { describe, test, vi, expect, beforeEach } from "vitest";
import { screen, render, act } from "@testing-library/svelte";
import { writable } from "svelte/store";
import userEvent from "@testing-library/user-event";

import OutNoteTable from "../OutNoteTable.svelte";
import InventoryTable from "../InventoryTable.svelte";

import { createTable } from "../table";

import { outNoteRows, rows } from "./data";

describe("OutNoteTable", () => {
	const tableOptions = writable({
		data: outNoteRows
	});

	// Reset the test table before each test
	beforeEach(() => {
		tableOptions.set({ data: outNoteRows });
	});

	test("should dispatch transaction update on warehouse change", async () => {
		const mockOnUpdate = vi.fn();

		const table = createTable(tableOptions);

		const { component } = render(OutNoteTable, { table });
		component.$on("transactionupdate", (e) => mockOnUpdate(e.detail));

		// Update the warehouse of the first row (wh1 -> wh2)
		screen.getAllByRole("combobox")[0].click();
		await act(() => {
			// Even though other comboboxes are closed, the selection is merely hidden my CSS (so still in the DOM),
			// therefore, we're selecting the first out of "all" to update the correct transaction (first row).
			screen.getAllByText("Warehouse 2")[0].click();
		});

		const { isbn, quantity, warehouseId } = outNoteRows[0];
		const matchTxn = { isbn, quantity, warehouseId };
		const updateTxn = { ...matchTxn, warehouseId: "wh2" };

		expect(mockOnUpdate).toHaveBeenCalledWith({ updateTxn, matchTxn });
	});

	test("should dispatch transaction update on quantity change", async () => {
		const mockOnUpdate = vi.fn();

		const table = createTable(tableOptions);

		const { component } = render(OutNoteTable, { table });
		component.$on("transactionupdate", (e) => mockOnUpdate(e.detail));

		// Update the quantity of the first row (3 -> 2)
		const quantityInput = screen.getAllByRole("spinbutton")[0];
		await act(() => userEvent.clear(quantityInput));
		await act(() => userEvent.type(quantityInput, "2"));
		// Submit the update
		await act(() => userEvent.keyboard("{enter}"));

		const { isbn, quantity, warehouseId } = outNoteRows[0];
		const matchTxn = { isbn, quantity, warehouseId };
		const updateTxn = { ...matchTxn, quantity: 2 };

		expect(mockOnUpdate).toHaveBeenCalledWith({ updateTxn, matchTxn });
	});

	test("should not dispatch transaction update if no transaction changed", async () => {
		// We're testing this by updating the table data with the exact same data (simulating a db sending updated stream)
		// to prevent the table from dispatching a transaction update event, resulting in feedback loop of sorts: infinite updates
		const mockOnUpdate = vi.fn();

		const table = createTable(tableOptions);

		const { component } = render(OutNoteTable, { table });
		component.$on("transactionupdate", (e) => mockOnUpdate(e.detail));

		// Update the table data with the exact same data (simulating a db sending updated stream)
		await act(() => tableOptions.set({ data: outNoteRows }));

		// No transaction update should be dispatched as there's no actual change in state
		expect(mockOnUpdate).not.toHaveBeenCalled();
	});
});

describe("InventoryTable", () => {
	const tableOptions = writable({
		data: rows
	});

	// Reset the test table before each test
	beforeEach(() => {
		tableOptions.set({ data: rows });
	});

	test("should dispatch transaction update on quantity change", async () => {
		const mockOnUpdate = vi.fn();

		const table = createTable(tableOptions);

		const { component } = render(InventoryTable, { table });
		component.$on("transactionupdate", (e) => mockOnUpdate(e.detail));

		// Update the quantity of the first row (3 -> 2)
		const quantityInput = screen.getAllByRole("spinbutton")[0];
		await act(() => userEvent.clear(quantityInput));
		await act(() => userEvent.type(quantityInput, "2"));
		// Submit the update
		await act(() => userEvent.keyboard("{enter}"));

		const { isbn, quantity } = rows[0];
		const matchTxn = { isbn, quantity };
		const updateTxn = { ...matchTxn, quantity: 2 };

		expect(mockOnUpdate).toHaveBeenCalledWith({ updateTxn, matchTxn });
	});

	test("should not dispatch transaction update if no transaction changed", async () => {
		// We're testing this by updating the table data with the exact same data (simulating a db sending updated stream)
		// to prevent the table from dispatching a transaction update event, resulting in feedback loop of sorts: infinite updates
		const mockOnUpdate = vi.fn();

		const table = createTable(tableOptions);

		const { component } = render(InventoryTable, { table });
		component.$on("transactionupdate", (e) => mockOnUpdate(e.detail));

		// Update the table data with the exact same data (simulating a db sending updated stream)
		await act(() => tableOptions.set({ data: rows }));

		// No transaction update should be dispatched as there's no actual change in state
		expect(mockOnUpdate).not.toHaveBeenCalled();
	});
});
