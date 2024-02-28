import { describe, test, vi, expect } from "vitest";
import { render, waitFor } from "@testing-library/svelte";

import type { WarehouseChangeDetail } from "../types";

import WarehouseSelect from "../../WarehouseSelect/WarehouseSelect.svelte";

import { rows, availableWarehouses } from "$lib/__testData__/rowData";

describe("WarehouseSelect", async () => {
	// See comment below
	test.skip("should dispatch change with the only available warehouse (if only one available and no warehouse selected)", async () => {
		const mockOnChange = vi.fn();

		const row = rows[0];
		const { warehouseId, warehouseName } = row;

		const { component } = render(WarehouseSelect, {
			rowIx: 0,
			data: {
				...row,
				availableWarehouses: new Map([[warehouseId, { displayName: warehouseName, quantity: 1 }]])
			}
		});
		// We're testing for an event that should be dispatched onMount, and it seems the event gets dispatched before we assign the listener.
		// TODO: This probably isn't the best way to handle this anyway (should happen on db side of things probably)
		component.$on("change", (e: CustomEvent<WarehouseChangeDetail>) => mockOnChange(e.detail.warehouseId));

		await waitFor(() => expect(mockOnChange).toHaveBeenCalledWith(warehouseId));
	});

	test("should not dispatch any automatic change if warehouse already selected", async () => {
		const mockOnChange = vi.fn();

		const row = rows[0];
		const { warehouseId, warehouseName } = row;

		const { component } = render(WarehouseSelect, {
			rowIx: 0,
			data: {
				...row,
				availableWarehouses: new Map([[warehouseId, { displayName: warehouseName, quantity: 1 }]])
			}
		});
		component.$on("change", (e: CustomEvent<WarehouseChangeDetail>) => mockOnChange(e.detail.warehouseId));

		// Not the best way to test this, but if it's going to happed, it's going to happen after the first 'tick'
		await new Promise((res) => setTimeout(res, 200));
		expect(mockOnChange).not.toHaveBeenCalled();
	});

	test("should not dispatch any automatic change if there's more than one warehouse for selection", async () => {
		const mockOnChange = vi.fn();

		const row = rows[0];

		const { component } = render(WarehouseSelect, {
			rowIx: 0,
			data: {
				...row,
				availableWarehouses
			}
		});
		component.$on("change", (e: CustomEvent<WarehouseChangeDetail>) => mockOnChange(e.detail.warehouseId));

		// Not the best way to test this, but if it's going to happed, it's going to happen after the first 'tick'
		await new Promise((res) => setTimeout(res, 200));
		expect(mockOnChange).not.toHaveBeenCalled();
	});
});
