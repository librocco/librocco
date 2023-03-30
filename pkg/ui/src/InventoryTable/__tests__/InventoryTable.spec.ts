import { describe, test, vi, expect } from "vitest";
import { screen, render, act } from "@testing-library/svelte";
import { writable } from "svelte/store";
import userEvent from "@testing-library/user-event";

import OutNoteTable from "../OutNoteTable.svelte";
import InventoryTable from "../InventoryTable.svelte";

import { createTable } from "../table";

import { outNoteRows, rows } from "./data";
import type { InventoryTableData, OutNoteTableData } from "../types";

describe("InventoryTable", () => {
	runCommonTests(InventoryTable, rows);
});

describe("OutNoteTable", () => {
	test("should dispatch transaction update on warehouse change", async () => {
		const tableOptions = writable({ data: outNoteRows });

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

	runCommonTests(OutNoteTable, outNoteRows);
});

/**
 * Run common tests is here to avoid code duplication for testing of the behaviour
 * which we expect from both table variants.
 */
const runCommonTests = (TableComponent: typeof OutNoteTable | typeof InventoryTable, data: OutNoteTableData[] | InventoryTableData[]) => {
	const tableOptions = writable({ data });

	test("should dispatch transaction update on quantity change", async () => {
		const mockOnUpdate = vi.fn();

		const table = createTable(tableOptions);

		const { component } = render(TableComponent, { table });
		component.$on("transactionupdate", (e) => mockOnUpdate(e.detail));

		// Update the quantity of the first row (3 -> 2)
		const quantityInput = screen.getAllByRole("spinbutton")[0];
		await act(() => userEvent.clear(quantityInput));
		await act(() => userEvent.type(quantityInput, "2"));
		// Submit the update
		await act(() => userEvent.keyboard("{enter}"));

		const { isbn, quantity, warehouseId } = data[0];
		const matchTxn = { isbn, quantity, warehouseId };
		const updateTxn = { ...matchTxn, quantity: 2 };

		expect(mockOnUpdate).toHaveBeenCalledWith({ updateTxn, matchTxn });
	});

	test("should not dispatch transaction update if no transaction changed", async () => {
		// We're testing this by updating the table data with the exact same data (simulating a db sending updated stream)
		// to prevent the table from dispatching a transaction update event, resulting in feedback loop of sorts: infinite updates
		const mockOnUpdate = vi.fn();

		const table = createTable(tableOptions);

		const { component } = render(TableComponent, { table });
		component.$on("transactionupdate", (e) => mockOnUpdate(e.detail));

		// Update the table data with the exact same data (simulating a db sending updated stream)
		await act(() => tableOptions.set({ data }));

		// No transaction update should be dispatched as there's no actual change in state
		expect(mockOnUpdate).not.toHaveBeenCalled();
	});

	test("should dispatch 'removetransactions' event, with transactions selected for deletion, on delete button click", async () => {
		const mockOnRemove = vi.fn();

		const table = createTable(tableOptions);

		const { component } = render(TableComponent, { table });
		component.$on("removetransactions", (e) => mockOnRemove(e.detail));

		// Select the first two transactions
		await Promise.all(
			data.slice(0, 2).map(({ title }) =>
				act(() =>
					userEvent.click(
						// This is against the testing-library's credo (not using DOM selectors),
						// but there's no other (remotely convenient) way to do this in this case.
						document.querySelector(`input[name="Select ${title}"]`)
					)
				)
			)
		);

		// Click the delete button
		await act(() => screen.getByText(/Delete/).click());

		// Remove transactions should be dispatched with with the selected transactions
		let wantRemoved = data.slice(0, 2).map(({ isbn, warehouseId }) => ({ isbn, warehouseId }));
		expect(mockOnRemove).toHaveBeenCalledWith(wantRemoved);

		// Do another check for all transactions
		// Note: the component is not connected to the db, so no rows are actually removed (only the event is dispatched and selection cleared)
		//
		// The first checkbox is always the select/unselect all.
		await act(() => userEvent.click(screen.getAllByRole("checkbox")[0]));

		// Click the delete button
		await act(() => screen.getByText(/Delete/).click());

		// Remove transactions should be dispatched with with the selected transactions
		wantRemoved = data.map(({ isbn, warehouseId }) => ({ isbn, warehouseId }));
		expect(mockOnRemove).toHaveBeenCalledWith(wantRemoved);
	});
};
