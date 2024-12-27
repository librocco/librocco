import { describe, it, expect, beforeEach } from "vitest";

import { type DB } from "../types";

import { getRandomDb, createCustomerOrders } from "./lib";

import {
	getAllReconciliationOrders,
	createReconciliationOrder,
	getReconciliationOrder,
	addOrderLinesToReconciliationOrder,
	finalizeReconciliationOrder
} from "../order-reconciliation";
import { createSupplierOrder, getPlacedSupplierOrders, getPossibleSupplierOrderLines } from "../suppliers";
import { getCustomerBooks } from "../customers";

// TODO: this needs some work... leaving till reconcilation wiring in effort/updates
describe("Suppliers order creation", () => {
	let db: DB;
	beforeEach(async () => {
		db = await getRandomDb();
		await createCustomerOrders(db);
	});

	it("can get all currently reconciliating orders", async () => {
		const res = await getAllReconciliationOrders(db);
		expect(res).toEqual([]);

		const newSupplierOrderLines = await getPossibleSupplierOrderLines(db, 1);
		await createSupplierOrder(db, newSupplierOrderLines);

		// TODO: might be useful to have a way to filter for a few particular ids?
		// It's only going to be one here...
		const supplierOrders = await getPlacedSupplierOrders(db);

		const ids = supplierOrders.map((supplierOrder) => supplierOrder.id);

		// use supplier order ids to create a recon
		await createReconciliationOrder(db, ids);
		const res2 = await getAllReconciliationOrders(db);

		expect(res2).toMatchObject([
			{
				customer_order_line_ids: null,
				id: 1,
				supplier_order_ids: "[1]",
				finalized: 0
			}
		]);
	});
	it("can create a reconciliation order", async () => {
		const newSupplierOrderLines = await getPossibleSupplierOrderLines(db, 1);
		await createSupplierOrder(db, newSupplierOrderLines);

		// TODO: might be useful to have a way to filter for a few particular ids?
		// It's only going to be one here...
		const supplierOrders = await getPlacedSupplierOrders(db);

		const ids = supplierOrders.map((supplierOrder) => supplierOrder.id);

		const reconOrderId = await createReconciliationOrder(db, ids);
		expect(reconOrderId).toStrictEqual(1);
		const res2 = await getReconciliationOrder(db, reconOrderId);

		expect(res2).toMatchObject({
			customer_order_line_ids: null,
			id: 1,
			supplier_order_ids: "[1]",
			finalized: 0
		});
	});
	it("can update a currently reconciliating order", async () => {
		const newSupplierOrderLines = await getPossibleSupplierOrderLines(db, 1);
		await createSupplierOrder(db, newSupplierOrderLines);

		// TODO: might be useful to have a way to filter for a few particular ids?
		// It's only going to be one here...
		const supplierOrders = await getPlacedSupplierOrders(db);

		const ids = supplierOrders.map((supplierOrder) => supplierOrder.id);

		const reconOrderId = await createReconciliationOrder(db, ids);
		expect(reconOrderId).toStrictEqual(1);
		const res2 = await getReconciliationOrder(db, reconOrderId);

		expect(res2).toMatchObject({
			customer_order_line_ids: null,
			id: 1,
			supplier_order_ids: "[1]",
			finalized: 0
		});

		await addOrderLinesToReconciliationOrder(db, 1, ["123", "435", "324"]);

		const res3 = await getReconciliationOrder(db, reconOrderId);

		expect(res3).toMatchObject({
			customer_order_line_ids: `["123","435","324"]`,
			id: 1,
			supplier_order_ids: "[1]",
			finalized: 0
		});
	});

	it("can finalize a currently reconciliating order", async () => {
		const newSupplierOrderLines = await getPossibleSupplierOrderLines(db, 1);
		await createSupplierOrder(db, newSupplierOrderLines);

		// TODO: might be useful to have a way to filter for a few particular ids?
		// It's only going to be one here...
		const supplierOrders = await getPlacedSupplierOrders(db);

		const ids = supplierOrders.map((supplierOrder) => supplierOrder.id);

		const reconOrderId = await createReconciliationOrder(db, ids);

		await addOrderLinesToReconciliationOrder(db, reconOrderId, ["1"]);

		await finalizeReconciliationOrder(db, reconOrderId);
		const res3 = await getReconciliationOrder(db, reconOrderId);

		const books = await getCustomerBooks(db, 1);
		expect(books[0].received).toBeInstanceOf(Date);
		expect(res3).toMatchObject({
			customer_order_line_ids: `["1"]`,
			id: 1,
			supplier_order_ids: "[1]",
			finalized: 1
		});
	});

	describe("Reconciliation order error cases", () => {
		let db: DB;
		beforeEach(async () => {
			db = await getRandomDb();
			await createCustomerOrders(db);
		});

		it("throws error when trying to create with empty supplier order IDs", async () => {
			await expect(createReconciliationOrder(db, [])).rejects.toThrow("Reconciliation order must be based on at least one supplier order");
		});

		it("throws error when reconciliation order doesn't exist", async () => {
			const nonExistentId = 999;
			await expect(addOrderLinesToReconciliationOrder(db, nonExistentId, ["123"])).rejects.toThrow(
				`Reconciliation order ${nonExistentId} not found`
			);
		});

		it("throws error when trying to get non-existent order", async () => {
			const nonExistentId = 999;
			await expect(getReconciliationOrder(db, nonExistentId)).rejects.toThrow(`Reconciliation order with id ${nonExistentId} not found`);
		});

		it("throws error when trying to finalize with no id", async () => {
			await expect(finalizeReconciliationOrder(db, 0)).rejects.toThrow("Reconciliation order must have an id");
		});

		it("throws error when trying to finalize an already finalized order", async () => {
			const newSupplierOrderLines = await getPossibleSupplierOrderLines(db, 1);
			await createSupplierOrder(db, newSupplierOrderLines);

			// TODO: might be useful to have a way to filter for a few particular ids?
			// It's only going to be one here...
			const supplierOrders = await getPlacedSupplierOrders(db);

			const ids = supplierOrders.map((supplierOrder) => supplierOrder.id);

			const reconOrderId = await createReconciliationOrder(db, ids);

			await finalizeReconciliationOrder(db, reconOrderId);

			await expect(finalizeReconciliationOrder(db, reconOrderId)).rejects.toThrow(
				`Reconciliation order ${reconOrderId} is already finalized`
			);
		});

		it("throws error when customer order lines are in invalid JSON format", async () => {
			const newSupplierOrderLines = await getPossibleSupplierOrderLines(db, 1);
			await createSupplierOrder(db, newSupplierOrderLines);

			// TODO: might be useful to have a way to filter for a few particular ids?
			// It's only going to be one here...
			const supplierOrders = await getPlacedSupplierOrders(db);

			const ids = supplierOrders.map((supplierOrder) => supplierOrder.id);

			const reconOrderId = await createReconciliationOrder(db, ids);

			// Directly insert malformed JSON
			await db.exec("UPDATE reconciliation_order SET customer_order_line_ids = ? WHERE id = ?", ["{invalid-json", reconOrderId]);

			await expect(finalizeReconciliationOrder(db, reconOrderId)).rejects.toThrow(
				`Invalid customer order lines format in reconciliation order ${reconOrderId}`
			);
		});
	});

	describe("Reconciliation order finalization", () => {
		beforeEach(async () => {
			await createCustomerOrders(db);
			const newSupplierOrderLines = await getPossibleSupplierOrderLines(db, 1);
			await createSupplierOrder(db, newSupplierOrderLines);

			// TODO: might be useful to have a way to filter for a few particular ids?
			// It's only going to be one here...
		});

		it("fetches reconciliation order", async () => {
			const supplierOrders = await getPlacedSupplierOrders(db);

			const ids = supplierOrders.map((supplierOrder) => supplierOrder.id);

			const reconOrderId = await createReconciliationOrder(db, ids);

			await addOrderLinesToReconciliationOrder(db, reconOrderId, ["1"]);
			expect(await getReconciliationOrder(db, reconOrderId)).toMatchObject({
				customer_order_line_ids: `["1"]`,
				finalized: 0,
				id: 1,
				supplier_order_ids: "[1]"
			});
		});
	});
});
