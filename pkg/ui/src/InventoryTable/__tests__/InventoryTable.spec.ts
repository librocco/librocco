import { describe, test, vi, expect, beforeEach } from "vitest";
import { screen, render, act } from "@testing-library/svelte";
import { writable } from "svelte/store";

import OutNoteTable from "../OutNoteTable.svelte";

import { createTable } from "../table";

import { outNoteRows } from "./data";

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

	test("should not dispatch transaction update if the warehouse hasn't changed", async () => {
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
