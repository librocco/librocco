import { describe, it, expect, beforeEach } from "vitest";

import { type DB } from "../types";

import { getRandomDb, createCustomerOrders } from "./lib";

import {
	getAllReconciliationOrders,
	createReconciliationOrder,
	getReconciliationOrder,
	addOrderLinesToReconciliationOrder,
	finalizeReconciliationOrder,
	getReconciliationOrderLines
} from "../order-reconciliation";
import { createSupplierOrder, getPlacedSupplierOrders, getPossibleSupplierOrderLines } from "../suppliers";
import { getCustomerBooks } from "../customers";

// TODO: this needs some work... leaving till reconcilation wiring in effort/updates
describe("Reconciliation order creation", () => {
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
			id: 1,
			supplierOrderIds: [1],
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
			id: 1,
			supplierOrderIds: [1],
			finalized: 0
		});

		await addOrderLinesToReconciliationOrder(db, 1, [
			{ isbn: "1", quantity: 1 },
			{ isbn: "1", quantity: 1 },
			{ isbn: "2", quantity: 1 },
			{ isbn: "3", quantity: 1 }
		]);

		const res3 = await getReconciliationOrderLines(db, reconOrderId);

		expect(res3).toEqual([
			{
				isbn: "1",
				reconciliation_order_id: 1,
				quantity: 2,
				publisher: "MathsAndPhysicsPub",
				title: "Physics",
				price: 7,
				authors: null
			},
			{
				isbn: "2",
				reconciliation_order_id: 1,
				quantity: 1,
				publisher: "ChemPub",
				title: "Chemistry",
				price: 13,
				authors: null
			},
			{
				isbn: "3",
				reconciliation_order_id: 1,
				quantity: 1,
				publisher: "PhantasyPub",
				title: "The Hobbit",
				price: 5,
				authors: null
			}
		]);
	});

	it("can finalize a currently reconciliating order", async () => {
		const newSupplierOrderLines = await getPossibleSupplierOrderLines(db, 1);
		await createSupplierOrder(db, newSupplierOrderLines);

		// TODO: might be useful to have a way to filter for a few particular ids?
		// It's only going to be one here...
		const supplierOrders = await getPlacedSupplierOrders(db);

		const ids = supplierOrders.map((supplierOrder) => supplierOrder.id);

		const reconOrderId = await createReconciliationOrder(db, ids);

		await addOrderLinesToReconciliationOrder(db, reconOrderId, [{ isbn: "1", quantity: 1 }]);

		await finalizeReconciliationOrder(db, reconOrderId);
		const res3 = await getReconciliationOrder(db, reconOrderId);

		const books = await getCustomerBooks(db, 1);
		expect(books[0].received).toBeInstanceOf(Date);
		expect(res3).toMatchObject({
			id: 1,
			supplierOrderIds: [1],
			finalized: 1
		});
	});

	it("updates existing order line quantity when adding duplicate ISBN", async () => {
		const newSupplierOrderLines = await getPossibleSupplierOrderLines(db, 1);
		await createSupplierOrder(db, newSupplierOrderLines);

		const supplierOrders = await getPlacedSupplierOrders(db);
		const ids = supplierOrders.map((supplierOrder) => supplierOrder.id);

		const reconOrderId = await createReconciliationOrder(db, ids);

		await addOrderLinesToReconciliationOrder(db, reconOrderId, [
			{ isbn: "1", quantity: 3 },
			{ isbn: "2", quantity: 1 }
		]);

		await addOrderLinesToReconciliationOrder(db, reconOrderId, [
			{ isbn: "1", quantity: 2 },
			{ isbn: "3", quantity: 1 }
		]);

		const orderLines = await getReconciliationOrderLines(db, reconOrderId);

		expect(orderLines).toEqual([
			{
				isbn: "1",
				reconciliation_order_id: reconOrderId,
				quantity: 5,
				publisher: "MathsAndPhysicsPub",
				title: "Physics",
				price: 7,
				authors: null
			},
			{
				isbn: "2",
				reconciliation_order_id: reconOrderId,
				quantity: 1,
				publisher: "ChemPub",
				title: "Chemistry",
				price: 13,
				authors: null
			},
			{
				isbn: "3",
				reconciliation_order_id: reconOrderId,
				quantity: 1,
				publisher: "PhantasyPub",
				title: "The Hobbit",
				price: 5,
				authors: null
			}
		]);
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
			await expect(addOrderLinesToReconciliationOrder(db, nonExistentId, [{ isbn: "123", quantity: 1 }])).rejects.toThrow(
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
	});
});
