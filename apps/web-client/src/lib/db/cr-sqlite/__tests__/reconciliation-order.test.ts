import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

import { type DB, type ProcessedOrderLine } from "../types";

import { getRandomDb, createCustomerOrders } from "./lib";

import {
	getAllReconciliationOrders,
	createReconciliationOrder,
	getReconciliationOrder,
	addOrderLinesToReconciliationOrder,
	finalizeReconciliationOrder,
	getReconciliationOrderLines,
	processOrderDelivery,
	getUnreconciledSupplierOrders,
	sortLinesBySupplier
} from "../order-reconciliation";
import { createSupplierOrder, getPlacedSupplierOrders, getPossibleSupplierOrderLines } from "../suppliers";
import { addBooksToCustomer, getCustomerOrderLines, upsertCustomer } from "../customers";

// TODO: this needs some work... leaving till reconcilation wiring in effort/updates
describe("Reconciliation order creation", () => {
	let db: DB;
	beforeEach(async () => {
		db = await getRandomDb();
		await createCustomerOrders(db);
	});

	it("can get all reconciliation orders", async () => {
		const res = await getAllReconciliationOrders(db);
		expect(res).toEqual([]);

		const newSupplierOrderLines = await getPossibleSupplierOrderLines(db, 1);
		await createSupplierOrder(db, 1, newSupplierOrderLines);

		// TODO: might be useful to have a way to filter for a few particular ids?
		// It's only going to be one here...
		const supplierOrders = await getPlacedSupplierOrders(db);

		const ids = supplierOrders.map((supplierOrder) => supplierOrder.id);

		// use supplier order ids to create a recon
		await createReconciliationOrder(db, ids);

		expect(await getAllReconciliationOrders(db)).toMatchObject([
			{
				id: 1,
				supplierOrderIds: [1],
				finalized: 0
			}
		]);
	});

	it("can get all finalized reconciliation orders", async () => {
		const res = await getAllReconciliationOrders(db);
		expect(res).toEqual([]);

		const newSupplierOrderLines = await getPossibleSupplierOrderLines(db, 1);
		await createSupplierOrder(db, 1, newSupplierOrderLines);

		const supplierOrders = await getPlacedSupplierOrders(db);

		const ids = supplierOrders.map((supplierOrder) => supplierOrder.id);

		// use supplier order ids to create a recon
		const reconId = await createReconciliationOrder(db, ids);

		await finalizeReconciliationOrder(db, reconId);
		const res2 = await getAllReconciliationOrders(db, true);

		expect(res2).toMatchObject([
			{
				id: 1,
				supplierOrderIds: [1],
				finalized: 1
			}
		]);
	});

	it("can get all currently reconciliating orders", async () => {
		const newSupplierOrderLines = await getPossibleSupplierOrderLines(db, 1);
		await createSupplierOrder(db, 1, newSupplierOrderLines);

		// TODO: might be useful to have a way to filter for a few particular ids?
		// It's only going to be one here...
		const supplierOrders = await getPlacedSupplierOrders(db);

		const ids = supplierOrders.map((supplierOrder) => supplierOrder.id);

		// use supplier order ids to create a recon
		const id = await createReconciliationOrder(db, ids);

		const res = await getAllReconciliationOrders(db, false);
		expect(res).toEqual([
			{
				id: 1,
				supplierOrderIds: [1],
				finalized: 0,
				created: expect.any(Date),
				updatedAt: expect.any(Date)
			}
		]);

		await finalizeReconciliationOrder(db, id);
		const res2 = await getAllReconciliationOrders(db, false);

		expect(res2).toMatchObject([]);
	});

	it("can create a reconciliation order", async () => {
		const newSupplierOrderLines = await getPossibleSupplierOrderLines(db, 1);
		await createSupplierOrder(db, 1, newSupplierOrderLines);

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
		await createSupplierOrder(db, 1, newSupplierOrderLines);

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
		await createSupplierOrder(db, 1, newSupplierOrderLines);

		// TODO: might be useful to have a way to filter for a few particular ids?
		// It's only going to be one here...
		const supplierOrders = await getPlacedSupplierOrders(db);

		const ids = supplierOrders.map((supplierOrder) => supplierOrder.id);

		const reconOrderId = await createReconciliationOrder(db, ids);

		await addOrderLinesToReconciliationOrder(db, reconOrderId, [{ isbn: "1", quantity: 1 }]);

		await finalizeReconciliationOrder(db, reconOrderId);
		const res3 = await getReconciliationOrder(db, reconOrderId);

		const books = await getCustomerOrderLines(db, 1);
		expect(books[0].received).toBeInstanceOf(Date);
		expect(res3).toMatchObject({
			id: 1,
			supplierOrderIds: [1],
			finalized: 1
		});
	});

	it("marks customer order lines' 'received' timestamp with ms precision", async () => {
		const db = await getRandomDb();

		await upsertCustomer(db, { id: 1, displayId: "1" });
		await addBooksToCustomer(db, 1, ["1", "2"]);

		await createSupplierOrder(db, 1, [{ isbn: "1", quantity: 1, supplier_id: 1 }]);
		const [{ id: supplierOrder1Id }] = await getPlacedSupplierOrders(db);

		const reconOrder1Id = await createReconciliationOrder(db, [supplierOrder1Id]);
		await addOrderLinesToReconciliationOrder(db, reconOrder1Id, [{ isbn: "1", quantity: 1 }]);
		await finalizeReconciliationOrder(db, reconOrder1Id);

		const [orderLine1] = await getCustomerOrderLines(db, 1);
		expect(Date.now() - orderLine1.received.getTime()).toBeLessThan(100);

		await createSupplierOrder(db, 1, [{ isbn: "2", quantity: 1, supplier_id: 1 }]);
		const [{ id: supplierOrder2Id }] = await getPlacedSupplierOrders(db);

		const reconOrder2Id = await createReconciliationOrder(db, [supplierOrder2Id]);
		await addOrderLinesToReconciliationOrder(db, reconOrder2Id, [{ isbn: "2", quantity: 1 }]);
		await finalizeReconciliationOrder(db, reconOrder2Id);

		const [, orderLine2] = await getCustomerOrderLines(db, 1);
		expect(Date.now() - orderLine2.received.getTime()).toBeLessThan(100);
	});

	it("updates existing order line quantity when adding duplicate ISBN", async () => {
		const newSupplierOrderLines = await getPossibleSupplierOrderLines(db, 1);
		await createSupplierOrder(db, 1, newSupplierOrderLines);

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

	it("timestamps reconciliation order's 'created' with ms precision", async () => {
		const db = await getRandomDb();

		await upsertCustomer(db, { id: 1, displayId: "1" });
		await addBooksToCustomer(db, 1, ["1", "2"]);

		await createSupplierOrder(db, 1, [{ isbn: "1", quantity: 1, supplier_id: 1 }]);
		const [{ id: supplierOrder1Id }] = await getPlacedSupplierOrders(db);
		const reconOrder1Id = await createReconciliationOrder(db, [supplierOrder1Id]);

		const reconOrder1 = await getReconciliationOrder(db, reconOrder1Id);
		expect(Date.now() - reconOrder1.created.getTime()).toBeLessThan(200);

		await createSupplierOrder(db, 1, [{ isbn: "2", quantity: 1, supplier_id: 1 }]);
		const [{ id: supplierOrder2Id }] = await getPlacedSupplierOrders(db);
		const reconOrder2Id = await createReconciliationOrder(db, [supplierOrder2Id]);

		const reconOrder2 = await getReconciliationOrder(db, reconOrder2Id);
		expect(Date.now() - reconOrder2.created.getTime()).toBeLessThan(200);
	});

	it("timestamps reconciliation order's 'updatedAt' with ms precision", async () => {
		const db = await getRandomDb();

		await upsertCustomer(db, { id: 1, displayId: "1" });
		await addBooksToCustomer(db, 1, ["1"]);

		await createSupplierOrder(db, 1, [{ isbn: "1", quantity: 1, supplier_id: 1 }]);
		const [{ id: supplierOrderId }] = await getPlacedSupplierOrders(db);
		const reconOrderId = await createReconciliationOrder(db, [supplierOrderId]);

		const reconOrder = await getReconciliationOrder(db, reconOrderId);
		expect(Date.now() - reconOrder.updatedAt.getTime()).toBeLessThan(200);

		await addOrderLinesToReconciliationOrder(db, reconOrderId, [{ isbn: "1", quantity: 1 }]);
		const reconOrderUpdated = await getReconciliationOrder(db, reconOrderId);
		expect(reconOrderUpdated.updatedAt > reconOrder.updatedAt).toBe(true);
		expect(Date.now() - reconOrderUpdated.updatedAt.getTime()).toBeLessThan(200);
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

		it("throws error when trying to finalize an already finalized order", async () => {
			const newSupplierOrderLines = await getPossibleSupplierOrderLines(db, 1);
			await createSupplierOrder(db, 1, newSupplierOrderLines);

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

describe("finalizeReconciliationOrder should", async () => {
	it("finalize a reconciling order with single book (base case)", async () => {
		const db = await getRandomDb();

		await upsertCustomer(db, { id: 1, displayId: "1" });
		await addBooksToCustomer(db, 1, ["1", "2", "3"]);

		await createSupplierOrder(db, 1, [{ isbn: "1", quantity: 1, supplier_id: 1 }]);

		const [{ id: supplierOrderId }] = await getPlacedSupplierOrders(db);

		const reconOrderId = await createReconciliationOrder(db, [supplierOrderId]);
		await addOrderLinesToReconciliationOrder(db, reconOrderId, [{ isbn: "1", quantity: 1 }]);

		await finalizeReconciliationOrder(db, reconOrderId);
		expect(await getReconciliationOrder(db, reconOrderId)).toMatchObject({
			id: 1,
			supplierOrderIds: [1],
			finalized: 1
		});

		expect(await getCustomerOrderLines(db, 1)).toEqual([
			expect.objectContaining({ isbn: "1", received: expect.any(Date) }),
			expect.objectContaining({ isbn: "2", received: undefined }),
			expect.objectContaining({ isbn: "3", received: undefined })
		]);
	});

	it("finalize a reconciling order with multiple different books (same customer/supplier order)", async () => {
		const db = await getRandomDb();

		await upsertCustomer(db, { id: 1, displayId: "1" });
		await addBooksToCustomer(db, 1, ["1", "2", "3"]);

		await createSupplierOrder(db, 1, [
			{ isbn: "1", quantity: 1, supplier_id: 1 },
			{ isbn: "2", quantity: 1, supplier_id: 1 }
		]);

		const [{ id: supplierOrderId }] = await getPlacedSupplierOrders(db);

		const reconOrderId = await createReconciliationOrder(db, [supplierOrderId]);
		await addOrderLinesToReconciliationOrder(db, reconOrderId, [
			{ isbn: "1", quantity: 1 },
			{ isbn: "2", quantity: 1 }
		]);

		await finalizeReconciliationOrder(db, reconOrderId);

		expect(await getCustomerOrderLines(db, 1)).toEqual([
			expect.objectContaining({ isbn: "1", received: expect.any(Date) }),
			expect.objectContaining({ isbn: "2", received: expect.any(Date) }),
			expect.objectContaining({ isbn: "3", received: undefined })
		]);
	});

	it("finalize a reconciling order with multiple quantities of the same book (over multiple customer orders)", async () => {
		const db = await getRandomDb();

		await upsertCustomer(db, { id: 1, displayId: "1" });
		await upsertCustomer(db, { id: 2, displayId: "2" });

		await addBooksToCustomer(db, 1, ["1", "2", "3"]);
		await addBooksToCustomer(db, 2, ["1"]);

		await createSupplierOrder(db, 1, [{ isbn: "1", quantity: 2, supplier_id: 1 }]);

		const [{ id: supplierOrderId }] = await getPlacedSupplierOrders(db);

		const reconOrderId = await createReconciliationOrder(db, [supplierOrderId]);
		await addOrderLinesToReconciliationOrder(db, reconOrderId, [{ isbn: "1", quantity: 2 }]);

		await finalizeReconciliationOrder(db, reconOrderId);

		expect(await getCustomerOrderLines(db, 1)).toEqual([
			expect.objectContaining({ isbn: "1", received: expect.any(Date) }),
			expect.objectContaining({ isbn: "2", received: undefined }),
			expect.objectContaining({ isbn: "3", received: undefined })
		]);
		expect(await getCustomerOrderLines(db, 2)).toEqual([expect.objectContaining({ isbn: "1", received: expect.any(Date) })]);
	});

	it("reconcile customer order lines on first-come-first-served basis (in case only a subset of ordered books were delivered)", async () => {
		const db = await getRandomDb();

		await upsertCustomer(db, { id: 1, displayId: "1" });
		await upsertCustomer(db, { id: 2, displayId: "2" });
		await upsertCustomer(db, { id: 3, displayId: "3" });

		// First two to order should get their books
		await addBooksToCustomer(db, 2, ["1"]);
		await addBooksToCustomer(db, 3, ["1"]);
		// The last one won't be delivered
		await addBooksToCustomer(db, 1, ["1"]);

		await createSupplierOrder(db, 1, [{ isbn: "1", quantity: 3, supplier_id: 1 }]);

		const [{ id: supplierOrderId }] = await getPlacedSupplierOrders(db);

		const reconOrderId = await createReconciliationOrder(db, [supplierOrderId]);
		await addOrderLinesToReconciliationOrder(db, reconOrderId, [{ isbn: "1", quantity: 2 }]);

		await finalizeReconciliationOrder(db, reconOrderId);

		expect(await getCustomerOrderLines(db, 1)).toEqual([expect.objectContaining({ isbn: "1", received: undefined })]);
		expect(await getCustomerOrderLines(db, 2)).toEqual([expect.objectContaining({ isbn: "1", received: expect.any(Date) })]);
		expect(await getCustomerOrderLines(db, 3)).toEqual([expect.objectContaining({ isbn: "1", received: expect.any(Date) })]);
	});

	it("reconcile customer order lines on first-come-first-served basis (even if priority orders don't belong to the supplier order being reconciled)", async () => {
		const db = await getRandomDb();

		await upsertCustomer(db, { id: 1, displayId: "1" });
		await upsertCustomer(db, { id: 2, displayId: "2" });
		await upsertCustomer(db, { id: 3, displayId: "3" });

		// First supplier order
		await addBooksToCustomer(db, 1, ["1"]);
		await addBooksToCustomer(db, 2, ["1"]);
		// Second supplier order
		await addBooksToCustomer(db, 3, ["1"]);

		await createSupplierOrder(db, 1, [{ isbn: "1", quantity: 2, supplier_id: 1 }]);
		await createSupplierOrder(db, 1, [{ isbn: "1", quantity: 1, supplier_id: 1 }]);

		// NOTE: we're reconciling the 2nd supplier order (orders are sorted in reverse chronological order)
		const [{ id: supplierOrderId }] = await getPlacedSupplierOrders(db);

		const reconOrderId = await createReconciliationOrder(db, [supplierOrderId]);
		// Technically, the 1 book received was ordered for customer 3, but customer 1 had ordered 1st and they don't have their book yet
		await addOrderLinesToReconciliationOrder(db, reconOrderId, [{ isbn: "1", quantity: 1 }]);

		await finalizeReconciliationOrder(db, reconOrderId);

		expect(await getCustomerOrderLines(db, 1)).toEqual([expect.objectContaining({ isbn: "1", received: expect.any(Date) })]);
		expect(await getCustomerOrderLines(db, 2)).toEqual([expect.objectContaining({ isbn: "1", received: undefined })]);
		expect(await getCustomerOrderLines(db, 3)).toEqual([expect.objectContaining({ isbn: "1", received: undefined })]);
	});

	it("reject customer order lines starting from last created customer order line (even if not part of the supplier order being reconciled)", async () => {
		const db = await getRandomDb();

		await upsertCustomer(db, { id: 1, displayId: "1" });
		await upsertCustomer(db, { id: 2, displayId: "2" });
		await upsertCustomer(db, { id: 3, displayId: "3" });

		// First supplier order
		await addBooksToCustomer(db, 1, ["1"]);
		await addBooksToCustomer(db, 2, ["1"]);
		// Second supplier order
		await addBooksToCustomer(db, 3, ["1"]);

		await createSupplierOrder(db, 1, [{ isbn: "1", quantity: 2, supplier_id: 1 }]);
		await createSupplierOrder(db, 1, [{ isbn: "1", quantity: 1, supplier_id: 1 }]);

		// NOTE: we're reconciling the 1st supplier order (orders are sorted in reverse chronological order)
		const [, { id: supplierOrderId }] = await getPlacedSupplierOrders(db);

		const reconOrderId = await createReconciliationOrder(db, [supplierOrderId]);
		// Out of 2 books, only 1 arrived - 1 to reconcile (mark as received), 1 to reject (effectively marking as waiting to be re-ordered)
		await addOrderLinesToReconciliationOrder(db, reconOrderId, [{ isbn: "1", quantity: 1 }]);
		await finalizeReconciliationOrder(db, reconOrderId);

		expect(await getCustomerOrderLines(db, 1)).toEqual([
			expect.objectContaining({ isbn: "1", placed: expect.any(Date), received: expect.any(Date) })
		]);
		expect(await getCustomerOrderLines(db, 2)).toEqual([
			expect.objectContaining({ isbn: "1", placed: expect.any(Date), received: undefined })
		]);
		// Even though customer order line 3 was not placed as part of the supplier order being reconciled, it was rejected by 1 book missing from the order
		expect(await getCustomerOrderLines(db, 3)).toEqual([expect.objectContaining({ isbn: "1", placed: undefined, received: undefined })]);
	});

	// NOTE: In a case where the book was overdelivered (considering the respective supplier order), but there are more in-progress customer orders
	// for the same ISBN, it's ok for the overdelivered quantity to spill over to other customer order lines
	it("reconcile more customer order lines than initially ordered (if such exist), even if not part of the current supplier order", async () => {
		const db = await getRandomDb();

		await upsertCustomer(db, { id: 1, displayId: "1" });
		await upsertCustomer(db, { id: 2, displayId: "2" });
		await upsertCustomer(db, { id: 3, displayId: "3" });
		await upsertCustomer(db, { id: 4, displayId: "3" });

		// First supplier order
		await addBooksToCustomer(db, 1, ["1"]);
		await addBooksToCustomer(db, 2, ["1"]);
		// Second supplier order (1 book will be overdelivered in supplier order 1)
		await addBooksToCustomer(db, 3, ["1"]); // This line will be reconciled with supplier order 1 (even though ordered in supplier order 2)
		await addBooksToCustomer(db, 4, ["1"]); // Will not be reconciled - here to make sure only the overdeliver quantity spills over

		await createSupplierOrder(db, 1, [{ isbn: "1", quantity: 2, supplier_id: 1 }]);
		await createSupplierOrder(db, 1, [{ isbn: "1", quantity: 2, supplier_id: 1 }]);

		// NOTE: we're reconciling the 1st supplier order (orders are sorted in reverse chronological order)
		const [, { id: supplierOrderId }] = await getPlacedSupplierOrders(db);

		const reconOrderId = await createReconciliationOrder(db, [supplierOrderId]);
		await addOrderLinesToReconciliationOrder(db, reconOrderId, [{ isbn: "1", quantity: 3 }]);

		await finalizeReconciliationOrder(db, reconOrderId);

		// 1st supplier order
		expect(await getCustomerOrderLines(db, 1)).toEqual([
			expect.objectContaining({ isbn: "1", placed: expect.any(Date), received: expect.any(Date) })
		]);
		expect(await getCustomerOrderLines(db, 2)).toEqual([
			expect.objectContaining({ isbn: "1", placed: expect.any(Date), received: expect.any(Date) })
		]);

		// 2nd supplier order
		//
		// Customer 3 can be served early - book was overdelivered
		expect(await getCustomerOrderLines(db, 3)).toEqual([
			expect.objectContaining({ isbn: "1", placed: expect.any(Date), received: expect.any(Date) })
		]);
		// Customer 4 is waiting for their order (still pending)
		expect(await getCustomerOrderLines(db, 4)).toEqual([
			expect.objectContaining({ isbn: "1", placed: expect.any(Date), received: undefined })
		]);
	});

	it("reconcile pending customer order lines if overdelivered", async () => {
		const db = await getRandomDb();

		await upsertCustomer(db, { id: 1, displayId: "1" });
		await upsertCustomer(db, { id: 2, displayId: "2" });
		await upsertCustomer(db, { id: 3, displayId: "3" });
		await upsertCustomer(db, { id: 4, displayId: "3" });

		// First supplier order
		await addBooksToCustomer(db, 1, ["1"]);
		await addBooksToCustomer(db, 2, ["1"]);
		// Not part of any supplier order yet
		await addBooksToCustomer(db, 3, ["1"]); // This line will be reconciled with supplier order 1 (even though not yet orderd)
		await addBooksToCustomer(db, 4, ["1"]); // Will not be reconciled - here to make sure only the overdeliver quantity spills over

		await createSupplierOrder(db, 1, [{ isbn: "1", quantity: 2, supplier_id: 1 }]);

		// NOTE: only 1 supplier order was placed
		const [{ id: supplierOrderId }] = await getPlacedSupplierOrders(db);

		const reconOrderId = await createReconciliationOrder(db, [supplierOrderId]);
		await addOrderLinesToReconciliationOrder(db, reconOrderId, [{ isbn: "1", quantity: 3 }]);

		await finalizeReconciliationOrder(db, reconOrderId);

		// 1st supplier order
		expect(await getCustomerOrderLines(db, 1)).toEqual([
			expect.objectContaining({ isbn: "1", placed: expect.any(Date), received: expect.any(Date) })
		]);
		expect(await getCustomerOrderLines(db, 2)).toEqual([
			expect.objectContaining({ isbn: "1", placed: expect.any(Date), received: expect.any(Date) })
		]);

		// Not placed with supplier
		//
		// Customer 3 can be served early - book was overdelivered
		expect(await getCustomerOrderLines(db, 3)).toEqual([
			expect.objectContaining({ isbn: "1", placed: undefined, received: expect.any(Date) })
		]);
		// Customer 4 is waiting for their order to be placed (and eventually delivered)
		expect(await getCustomerOrderLines(db, 4)).toEqual([expect.objectContaining({ isbn: "1", placed: undefined, received: undefined })]);
	});

	it("be able to handle multiple supplier orders (case: orders fully filled)", async () => {
		const db = await getRandomDb();

		await upsertCustomer(db, { id: 1, displayId: "1" });
		await upsertCustomer(db, { id: 2, displayId: "2" });
		await upsertCustomer(db, { id: 3, displayId: "3" });

		// First supplier order
		await addBooksToCustomer(db, 1, ["1", "2", "3"]);
		await addBooksToCustomer(db, 2, ["1", "2"]);
		// Second supplier order
		await addBooksToCustomer(db, 3, ["1", "3"]);

		await createSupplierOrder(db, 1, [
			{ isbn: "1", quantity: 2, supplier_id: 1 },
			{ isbn: "2", quantity: 2, supplier_id: 1 },
			{ isbn: "3", quantity: 1, supplier_id: 1 }
		]);
		await createSupplierOrder(db, 1, [
			{ isbn: "1", quantity: 1, supplier_id: 1 },
			{ isbn: "3", quantity: 1, supplier_id: 1 }
		]);

		const supplierOrders = await getPlacedSupplierOrders(db);
		const supplierOrderIds = supplierOrders.map(({ id }) => id);

		const reconOrderId = await createReconciliationOrder(db, supplierOrderIds);
		await addOrderLinesToReconciliationOrder(db, reconOrderId, [
			{ isbn: "1", quantity: 3 },
			{ isbn: "2", quantity: 2 },
			{ isbn: "3", quantity: 2 }
		]);

		await finalizeReconciliationOrder(db, reconOrderId);

		expect(await getCustomerOrderLines(db, 1)).toEqual([
			expect.objectContaining({ isbn: "1", received: expect.any(Date) }),
			expect.objectContaining({ isbn: "2", received: expect.any(Date) }),
			expect.objectContaining({ isbn: "3", received: expect.any(Date) })
		]);
		expect(await getCustomerOrderLines(db, 2)).toEqual([
			expect.objectContaining({ isbn: "1", received: expect.any(Date) }),
			expect.objectContaining({ isbn: "2", received: expect.any(Date) })
		]);
		expect(await getCustomerOrderLines(db, 3)).toEqual([
			expect.objectContaining({ isbn: "1", received: expect.any(Date) }),
			expect.objectContaining({ isbn: "3", received: expect.any(Date) })
		]);
	});

	it("be able to handle multiple supplier orders (case: only a subset of the order filled)", async () => {
		const db = await getRandomDb();

		await upsertCustomer(db, { id: 1, displayId: "1" });
		await upsertCustomer(db, { id: 2, displayId: "2" });
		await upsertCustomer(db, { id: 3, displayId: "3" });

		// First supplier order
		await addBooksToCustomer(db, 1, ["1", "2", "3"]);
		await addBooksToCustomer(db, 2, ["1", "2"]);
		// Second supplier order
		await addBooksToCustomer(db, 3, ["1", "3"]);

		await createSupplierOrder(db, 1, [
			{ isbn: "1", quantity: 2, supplier_id: 1 },
			{ isbn: "2", quantity: 2, supplier_id: 1 },
			{ isbn: "3", quantity: 1, supplier_id: 1 }
		]);
		await createSupplierOrder(db, 1, [
			{ isbn: "1", quantity: 1, supplier_id: 1 },
			{ isbn: "3", quantity: 1, supplier_id: 1 }
		]);

		const supplierOrders = await getPlacedSupplierOrders(db);
		const supplierOrderIds = supplierOrders.map(({ id }) => id);

		const reconOrderId = await createReconciliationOrder(db, supplierOrderIds);
		await addOrderLinesToReconciliationOrder(db, reconOrderId, [
			{ isbn: "1", quantity: 1 },
			{ isbn: "3", quantity: 2 }
		]);

		await finalizeReconciliationOrder(db, reconOrderId);

		expect(await getCustomerOrderLines(db, 1)).toEqual([
			expect.objectContaining({ isbn: "1", received: expect.any(Date) }),
			expect.objectContaining({ isbn: "2", received: undefined }),
			expect.objectContaining({ isbn: "3", received: expect.any(Date) })
		]);
		expect(await getCustomerOrderLines(db, 2)).toEqual([
			expect.objectContaining({ isbn: "1", received: undefined }),
			expect.objectContaining({ isbn: "2", received: undefined })
		]);
		expect(await getCustomerOrderLines(db, 3)).toEqual([
			expect.objectContaining({ isbn: "1", received: undefined }),
			expect.objectContaining({ isbn: "3", received: expect.any(Date) })
		]);
	});

	// NOTE: This is the current implementation, maybe we want it to, in fact, explode in these cases
	it("not explode if quantity delivered exceeds quantity ordered", async () => {
		const db = await getRandomDb();

		await upsertCustomer(db, { id: 1, displayId: "1" });
		await upsertCustomer(db, { id: 2, displayId: "2" });

		await addBooksToCustomer(db, 1, ["1"]);
		await addBooksToCustomer(db, 2, ["1"]);

		await createSupplierOrder(db, 1, [{ isbn: "1", quantity: 2, supplier_id: 1 }]);
		const [{ id: supplierOrderId }] = await getPlacedSupplierOrders(db);

		const reconOrderId = await createReconciliationOrder(db, [supplierOrderId]);
		await addOrderLinesToReconciliationOrder(db, reconOrderId, [
			{ isbn: "1", quantity: 3 } // only 2 ordered
		]);

		await finalizeReconciliationOrder(db, reconOrderId);
		expect(await getReconciliationOrder(db, reconOrderId)).toMatchObject({
			id: 1,
			supplierOrderIds: [1],
			finalized: 1
		});

		expect(await getCustomerOrderLines(db, 1)).toEqual([expect.objectContaining({ isbn: "1", received: expect.any(Date) })]);
		expect(await getCustomerOrderLines(db, 2)).toEqual([expect.objectContaining({ isbn: "1", received: expect.any(Date) })]);
	});

	// NOTE: This is the current implementation, maybe we want it to, in fact, explode in these cases
	it("not explode if a delivered book was never ordered", async () => {
		const db = await getRandomDb();

		await upsertCustomer(db, { id: 1, displayId: "1" });

		await addBooksToCustomer(db, 1, ["1"]);

		await createSupplierOrder(db, 1, [{ isbn: "1", quantity: 1, supplier_id: 1 }]);
		const [{ id: supplierOrderId }] = await getPlacedSupplierOrders(db);

		const reconOrderId = await createReconciliationOrder(db, [supplierOrderId]);
		await addOrderLinesToReconciliationOrder(db, reconOrderId, [
			{ isbn: "1", quantity: 1 },
			{ isbn: "2", quantity: 1 } // was never ordered
		]);

		await finalizeReconciliationOrder(db, reconOrderId);
		expect(await getReconciliationOrder(db, reconOrderId)).toMatchObject({
			id: 1,
			supplierOrderIds: [1],
			finalized: 1
		});

		expect(await getCustomerOrderLines(db, 1)).toEqual([expect.objectContaining({ isbn: "1", received: expect.any(Date) })]);
	});

	it("prefer earlier customer order line, even if ordered multiple times", async () => {
		const db = await getRandomDb();

		await upsertCustomer(db, { id: 1, displayId: "1" });
		await upsertCustomer(db, { id: 2, displayId: "2" });

		// Ordering two books in order to be able to reconcile at least one
		await addBooksToCustomer(db, 1, ["1", "2"]);

		// Place and reconcile the supplier order
		//
		// ISBN 1 line was ordered here, but not delivered
		await createSupplierOrder(db, 1, [
			{ isbn: "1", quantity: 1, supplier_id: 1 }, // Placed, but won't be delivered
			{ isbn: "2", quantity: 1, supplier_id: 1 }
		]);
		const [{ id: supOrder1 }] = await getPlacedSupplierOrders(db);
		const recOrder1 = await createReconciliationOrder(db, [supOrder1]);
		await addOrderLinesToReconciliationOrder(db, recOrder1, [{ isbn: "2", quantity: 1 }]);
		await finalizeReconciliationOrder(db, recOrder1);

		expect(await getCustomerOrderLines(db, 1)).toEqual([
			expect.objectContaining({ isbn: "1", received: undefined }),
			expect.objectContaining({ isbn: "2", received: expect.any(Date) })
		]);

		// Order ISBN 1 for customer 2
		await addBooksToCustomer(db, 2, ["1"]);

		// Place the order with the supplier again
		await createSupplierOrder(db, 1, [{ isbn: "1", quantity: 2, supplier_id: 1 }]);
		// NOTE: the supplier orders are sorted by date in reverse order
		const [{ id: supOrder2 }] = await getPlacedSupplierOrders(db);

		// Only one delivered copy - should end up with customer 1
		const recOrder2 = await createReconciliationOrder(db, [supOrder2]);
		await addOrderLinesToReconciliationOrder(db, recOrder2, [{ isbn: "1", quantity: 1 }]);
		await finalizeReconciliationOrder(db, recOrder2);

		expect(await getCustomerOrderLines(db, 1)).toEqual([
			expect.objectContaining({ isbn: "1", received: expect.any(Date) }),
			expect.objectContaining({ isbn: "2", received: expect.any(Date) })
		]);
		expect(await getCustomerOrderLines(db, 2)).toEqual([expect.objectContaining({ isbn: "1", received: undefined })]);
	});

	it("prefer earlier customer order line, even if re-ordered with later supplier order", async () => {
		const db = await getRandomDb();

		await upsertCustomer(db, { id: 1, displayId: "1" });
		await upsertCustomer(db, { id: 2, displayId: "2" });

		// Place an order for the first customer - 1st supplier order
		await addBooksToCustomer(db, 1, ["1", "2"]);
		await createSupplierOrder(db, 1, [
			{ isbn: "1", quantity: 1, supplier_id: 1 }, // Placed, but won't be delivered
			{ isbn: "2", quantity: 1, supplier_id: 1 }
		]);

		// Place an order for the second customer - 2nd supplier order
		await addBooksToCustomer(db, 2, ["1"]);
		await createSupplierOrder(db, 1, [{ isbn: "1", quantity: 1, supplier_id: 1 }]);

		// Reconcile the 1st order - ISBN 1 for customer 1 not delivered
		//
		// NOTE: the supplier orders are sorted by date in reverse order
		const [, { id: supOrder1 }] = await getPlacedSupplierOrders(db);
		await createReconciliationOrder(db, [supOrder1]);
		const recOrder1 = await createReconciliationOrder(db, [supOrder1]);
		await addOrderLinesToReconciliationOrder(db, recOrder1, [{ isbn: "2", quantity: 1 }]);
		await finalizeReconciliationOrder(db, recOrder1);

		// Re-order the ISBN 1 for customer 1 - 3rd supplier order
		await createSupplierOrder(db, 1, [{ isbn: "1", quantity: 1, supplier_id: 1 }]);

		// Reconcile the 2nd and 3rd order - only one book delivered - should end up with customer 1 nonetheless
		// NOTE: the supplier orders are sorted by date in reverse order
		const [{ id: supOrder3 }, { id: supOrder2 }] = await getPlacedSupplierOrders(db);
		const recOrder2 = await createReconciliationOrder(db, [supOrder2, supOrder3]);
		await addOrderLinesToReconciliationOrder(db, recOrder2, [{ isbn: "1", quantity: 1 }]);
		await finalizeReconciliationOrder(db, recOrder2);

		expect(await getCustomerOrderLines(db, 1)).toEqual([
			expect.objectContaining({ isbn: "1", received: expect.any(Date) }),
			expect.objectContaining({ isbn: "2", received: expect.any(Date) })
		]);
		expect(await getCustomerOrderLines(db, 2)).toEqual([expect.objectContaining({ isbn: "1", received: undefined })]);
	});

	// TODO: trying to reconcile an already reconciled customer order - should be in 'createReconciliationOrder' segment
});

describe("getUnreconciledSupplierOrders", () => {
	let db: DB;

	beforeEach(async () => {
		db = await getRandomDb();
		await createCustomerOrders(db);
		const newSupplierOrderLines = await getPossibleSupplierOrderLines(db, 1);
		await createSupplierOrder(db, 1, newSupplierOrderLines);
	});

	it("should return only unreconciled supplier orders with correct totals", async () => {
		const result = await getUnreconciledSupplierOrders(db);

		expect(result).toHaveLength(1);

		expect(result[0]).toEqual({
			id: 1,
			supplier_id: 1,
			created: expect.any(Number),
			supplier_name: "Science Books LTD",
			total_book_number: 2
		});
	});

	it("should return empty array when all orders are reconciled", async () => {
		await createReconciliationOrder(db, [1, 3]);

		const result = await getUnreconciledSupplierOrders(db);
		expect(result).toHaveLength(0);
	});
});

describe("Misc helpers", () => {
	afterEach(() => {
		vi.clearAllMocks();
	});

	it("should process when delivery matches order exactly", () => {
		const scannedBooks = [{ isbn: "123", title: "Book 1", authors: "Author 1", price: 10, quantity: 2 }];

		const placedOrderLines = [
			{
				isbn: "123",
				title: "Book 1",
				authors: "Author 1",
				line_price: 10,
				quantity: 2,
				supplier_name: "Supplier 1",
				id: 1,
				supplier_id: 1,
				total_book_number: 1,
				supplier_order_id: 1,
				total_book_price: 10,
				created: Date.now()
			}
		];

		const result = processOrderDelivery(scannedBooks, placedOrderLines);
		expect(result).toEqual({
			processedLines: [
				{
					isbn: "123",
					title: "Book 1",
					authors: "Author 1",
					line_price: 10,
					quantity: 2,
					supplier_name: "Supplier 1",
					id: 1,
					supplier_id: 1,
					total_book_number: 1,
					supplier_order_id: 1,
					total_book_price: 10,
					deliveredQuantity: 2,
					orderedQuantity: 2,
					created: expect.any(Number)
				}
			],
			unmatchedBooks: []
		});
	});

	it("should handle partial delivery", () => {
		const scannedBooks = [{ isbn: "123", title: "Book 1", authors: "Author 1", price: 10, quantity: 1 }];

		const placedOrderLines = [
			{
				isbn: "123",
				title: "Book 1",
				authors: "Author 1",
				line_price: 10,
				quantity: 2,
				supplier_name: "Supplier 1",
				id: 1,
				supplier_id: 1,
				total_book_number: 1,
				supplier_order_id: 1,
				total_book_price: 10,
				created: Date.now()
			}
		];

		const result = processOrderDelivery(scannedBooks, placedOrderLines);
		expect(result).toEqual({
			processedLines: [
				{
					isbn: "123",
					title: "Book 1",
					authors: "Author 1",
					line_price: 10,
					quantity: 2,
					supplier_name: "Supplier 1",
					id: 1,
					supplier_id: 1,
					total_book_number: 1,
					supplier_order_id: 1,
					total_book_price: 10,
					deliveredQuantity: 1,
					orderedQuantity: 2,
					created: expect.any(Number)
				}
			],
			unmatchedBooks: []
		});
	});

	it("should handle over-delivery", () => {
		const scannedBooks = [{ isbn: "123", title: "Book 1", authors: "Author 1", price: 10, quantity: 3 }];

		const placedOrderLines = [
			{
				isbn: "123",
				title: "Book 1",
				authors: "Author 1",
				line_price: 10,
				quantity: 2,
				supplier_name: "Supplier 1",
				id: 1,
				supplier_id: 1,
				total_book_number: 1,
				supplier_order_id: 1,
				total_book_price: 10,
				created: Date.now()
			}
		];

		const result = processOrderDelivery(scannedBooks, placedOrderLines);
		expect(result).toEqual({
			processedLines: [
				{
					isbn: "123",
					title: "Book 1",
					authors: "Author 1",
					line_price: 10,
					quantity: 2,
					supplier_name: "Supplier 1",
					id: 1,
					supplier_id: 1,
					total_book_number: 1,
					supplier_order_id: 1,
					total_book_price: 10,
					deliveredQuantity: 3,
					orderedQuantity: 2,
					created: expect.any(Number)
				}
			],
			unmatchedBooks: []
		});
	});

	it("should handle unordered books", () => {
		const scannedBooks = [{ isbn: "456", title: "Book 2", authors: "Author 2", price: 15, quantity: 2 }];

		const placedOrderLines = [
			{
				isbn: "123",
				title: "Book 1",
				authors: "Author 1",
				line_price: 10,
				quantity: 2,
				supplier_name: "Supplier 1",
				id: 1,
				supplier_id: 1,
				total_book_number: 1,
				supplier_order_id: 1,
				total_book_price: 10,
				created: Date.now()
			}
		];

		const result = processOrderDelivery(scannedBooks, placedOrderLines);
		expect(result).toEqual({
			processedLines: [
				expect.objectContaining({
					authors: "Author 1",
					id: 1,
					isbn: "123",
					line_price: 10,
					quantity: 2,
					supplier_id: 1,
					supplier_name: "Supplier 1",
					supplier_order_id: 1,
					title: "Book 1",
					total_book_number: 1,
					total_book_price: 10,
					deliveredQuantity: 0,
					orderedQuantity: 2
				})
			],
			unmatchedBooks: [
				{
					authors: "Author 2",
					isbn: "456",
					price: 15,
					quantity: 2,

					title: "Book 2"
				}
			]
		});
	});

	it("should handle under-delivery", () => {
		const scannedBooks = [];

		const placedOrderLines = [
			{
				isbn: "123",
				title: "Book 1",
				authors: "Author 1",
				line_price: 10,
				quantity: 2,
				supplier_name: "Supplier 1",
				id: 1,
				supplier_id: 1,
				total_book_number: 1,
				total_book_price: 10,
				supplier_order_id: 1,
				created: Date.now()
			}
		];

		const result = processOrderDelivery(scannedBooks, placedOrderLines);
		expect(result).toEqual({
			processedLines: [
				expect.objectContaining({
					authors: "Author 1",
					id: 1,
					isbn: "123",
					line_price: 10,
					quantity: 2,
					supplier_id: 1,
					supplier_name: "Supplier 1",
					supplier_order_id: 1,
					title: "Book 1",
					total_book_number: 1,
					total_book_price: 10,
					deliveredQuantity: 0,
					orderedQuantity: 2
				})
			],
			unmatchedBooks: []
		});
	});

	it("should group order lines by supplier", () => {
		const orderLines = [
			{ supplier_name: "Supplier 1", isbn: "123" },
			{ supplier_name: "Supplier 2", isbn: "456" },
			{ supplier_name: "Supplier 1", isbn: "789" }
		] as ProcessedOrderLine[];

		const result = sortLinesBySupplier(orderLines);
		expect(Object.keys(result)).toHaveLength(2);
		expect(result["Supplier 1"]).toHaveLength(2);
		expect(result["Supplier 2"]).toHaveLength(1);
	});
});
