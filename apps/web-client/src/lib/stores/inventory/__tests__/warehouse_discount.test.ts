import { describe, test, expect, vi } from "vitest";
import { BehaviorSubject } from "rxjs";

import { testUtils } from "@librocco/shared";

import { createWarehouseDiscountStore } from "../warehouse_discount";

import { newTestDB } from "$lib/__testUtils__/db";

const { waitFor } = testUtils;

describe("createWarehouseDiscountStore", () => {
	test("should stream the warehouse discount from the db for given warehouse", async () => {
		const db = await newTestDB();
		const warehouse = await db.warehouse("warehouse-1").create();

		await warehouse.setDiscount({}, 10);

		const wd$ = createWarehouseDiscountStore({}, warehouse);
		let warehouseDiscount: number | undefined;
		wd$.subscribe((wd) => (warehouseDiscount = wd));

		await waitFor(() => {
			expect(warehouseDiscount).toEqual(10);
		});

		wd$.set(20);
		await waitFor(() => {
			expect(warehouseDiscount).toEqual(20);
		});
	});

	test("should propagate the update to the db itself", async () => {
		const db = await newTestDB();
		const warehouse = await db.warehouse().create();
		const wd$ = createWarehouseDiscountStore({}, warehouse);

		// Update to the warehouseDiscount store should get propagated to the db
		wd$.set(20);
		await waitFor(async () => {
			const { discountPercentage } = (await warehouse.get()) || {};
			expect(discountPercentage).toEqual(20);
		});
	});

	test("should not propagate updates to the db if set discount is not a number", async () => {
		const mockSetDiscount = vi.fn();
		const mockWarehouse = {
			setDiscount: mockSetDiscount,
			stream: () => ({
				discount: () => new BehaviorSubject(0)
			})
		} as any;

		const wd$ = createWarehouseDiscountStore({}, mockWarehouse);
		wd$.set(null);

		expect(mockSetDiscount).not.toHaveBeenCalled();
	});

	test("should not propagate updates to the db if the set discount is same as the current one", async () => {
		const mockSetDiscount = vi.fn();
		const mockWarehouse = {
			setDiscount: mockSetDiscount,
			stream: () => ({
				discount: () => new BehaviorSubject(10)
			})
		} as any;

		const wd$ = createWarehouseDiscountStore({}, mockWarehouse);
		wd$.set(10);

		expect(mockSetDiscount).not.toHaveBeenCalled();
	});

	test("should not explode if 'warehouse' is not provided", async () => {
		const wd$ = createWarehouseDiscountStore({}, undefined);
		let warehouseDiscount: number | undefined;
		wd$.subscribe((wd) => (warehouseDiscount = wd));
		expect(warehouseDiscount).toEqual(0);
	});
});
