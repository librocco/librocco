import { describe, it, expect } from "vitest";

import { asc } from "@librocco/shared";

import { getRandomDb } from "./lib";

import {
	getAllReconciliationOrders,
	createReconciliationOrder,
	getReconciliationOrder,
	finalizeReconciliationOrder,
	getReconciliationOrderLines,
	deleteReconciliationOrder,
	deleteOrderLineFromReconciliationOrder,
	ErrSupplierOrdersNotFound,
	ErrSupplierOrdersAlreadyReconciling,
	ErrReconciliationOrderNotFound,
	ErrReconciliationOrderFinalized,
	upsertReconciliationOrderLines
} from "../order-reconciliation";
import { createSupplierOrder, getPlacedSupplierOrders } from "../suppliers";
import { addBooksToCustomer, getCustomerOrderLines, upsertCustomer } from "../customers";
import { upsertBook } from "../books";

describe("Reconciliation order management:", () => {
	describe("createReconciliationOrder should", () => {
		it("create a reconciliation order based on a single supplier order", async () => {
			const db = await getRandomDb();

			// TODO: simplify this when we remove the tedious customer order line check at supplier order creation
			//
			// NOTE: add books to customer is detached from customer existing - we can do so without creating customers
			await addBooksToCustomer(db, 1, ["1"]);
			await createSupplierOrder(db, 1, 1, [{ isbn: "1", quantity: 1, supplier_id: 1 }]);

			await createReconciliationOrder(db, 1, [1]);
			const order = await getReconciliationOrder(db, 1);

			expect(order).toEqual({
				id: 1,
				supplierOrderIds: [1],
				finalized: false,
				created: expect.any(Date),
				updatedAt: expect.any(Date)
			});
			expect(order.created).toEqual(order.updatedAt);
		});

		it("create a single reconciliation order based on a multiple supplier orders", async () => {
			const db = await getRandomDb();

			// TODO: simplify this when we remove the tedious customer order line check at supplier order creation
			//
			// NOTE: add books to customer is detached from customer existing - we can do so without creating customers
			await addBooksToCustomer(db, 1, ["1"]);
			await createSupplierOrder(db, 1, 1, [{ isbn: "1", quantity: 1, supplier_id: 1 }]);
			// Different supplier order, different supplier - should work nonetheless
			await addBooksToCustomer(db, 2, ["2"]);
			await createSupplierOrder(db, 2, 2, [{ isbn: "2", quantity: 1, supplier_id: 2 }]);

			await createReconciliationOrder(db, 1, [1, 2]);

			// Matching for all reconciliation orders orders to make sure both supplier orders are grouped into one reconciliation order
			expect(await getAllReconciliationOrders(db)).toEqual([expect.objectContaining({ id: 1, supplierOrderIds: [1, 2] })]);
		});

		it("timestamp reconciliation order's 'created' with ms precision", async () => {
			const db = await getRandomDb();

			// TODO: simplify this when we remove the tedious customer order line check at supplier order creation
			//
			// NOTE: add books to customer is detached from customer existing - we can do so without creating customers
			await addBooksToCustomer(db, 1, ["1", "2"]);
			await createSupplierOrder(db, 1, 1, [{ isbn: "1", quantity: 1, supplier_id: 1 }]);
			await createReconciliationOrder(db, 1, [1]);

			const reconOrder1 = await getReconciliationOrder(db, 1);
			expect(Date.now() - reconOrder1.created.getTime()).toBeLessThan(400);

			await createSupplierOrder(db, 2, 1, [{ isbn: "2", quantity: 1, supplier_id: 1 }]);
			await createReconciliationOrder(db, 2, [2]);

			const reconOrder2 = await getReconciliationOrder(db, 2);
			expect(Date.now() - reconOrder2.created.getTime()).toBeLessThan(400);
		});

		it("throw an error when trying to create with empty supplier order IDs", async () => {
			const db = await getRandomDb();

			await expect(createReconciliationOrder(db, 1, [])).rejects.toThrow(
				"Reconciliation order must be based on at least one supplier order"
			);
		});

		it("throw an error if one or more of the provided supplier order ids doesn't match an existing supplier order", async () => {
			const db = await getRandomDb();

			// TODO: simplify this when we remove the tedious customer order line check at supplier order creation
			//
			// NOTE: add books to customer is detached from customer existing - we can do so without creating customers
			await addBooksToCustomer(db, 1, ["1"]);
			await createSupplierOrder(db, 1, 1, [{ isbn: "1", quantity: 1, supplier_id: 1 }]);

			// NOTE: we don't know the id of the created supplier order, but 2 and 3 don't exist
			const Ids = [1, 2, 3].sort(asc());
			await expect(createReconciliationOrder(db, 1, [1, 2, 3])).rejects.toThrow(new ErrSupplierOrdersNotFound(Ids, [1]));
		});

		it("throw an error if some of the provided supplier ids match an already reconciled (or reconciling in progress) supplier order", async () => {
			const db = await getRandomDb();

			await addBooksToCustomer(db, 1, ["1", "2", "3"]);
			// Supplier order 1 - reconciled
			await createSupplierOrder(db, 1, 1, [{ isbn: "1", quantity: 1, supplier_id: 1 }]);
			// Supplier order 2 - reconciliation in progress
			await createSupplierOrder(db, 2, 1, [{ isbn: "2", quantity: 1, supplier_id: 1 }]);
			// Supplier order 3 - available for reconciliation
			await createSupplierOrder(db, 3, 1, [{ isbn: "3", quantity: 1, supplier_id: 1 }]);

			// Reconcile supplier order 1
			await createReconciliationOrder(db, 1, [1]);
			const reconOrder1 = await getReconciliationOrder(db, 1);
			await finalizeReconciliationOrder(db, 1);
			// Start reconciling supplier order 2
			await createReconciliationOrder(db, 2, [2]);
			const reconOrder2 = await getReconciliationOrder(db, 2);

			expect(createReconciliationOrder(db, 3, [1, 2])).rejects.toThrow(
				new ErrSupplierOrdersAlreadyReconciling([1, 2], [reconOrder1, reconOrder2])
			);
		});
	});

	describe("getAllReconciliationOrders should", () => {
		it("retrieve all reconciliation orders from the database finalized or not, if finalized filter not provided", async () => {
			const db = await getRandomDb();

			// TODO: simplify this when we remove the tedious customer order line check at supplier order creation
			//
			// NOTE: add books to customer is detached from customer existing - we can do so without creating customers
			await addBooksToCustomer(db, 1, ["1", "2", "3"]);

			// Reconciliation order 1 - finalized
			await createSupplierOrder(db, 1, 1, [{ isbn: "1", quantity: 1, supplier_id: 1 }]);
			await createSupplierOrder(db, 2, 1, [{ isbn: "2", quantity: 1, supplier_id: 1 }]);
			await createReconciliationOrder(db, 1, [1, 2]);
			await finalizeReconciliationOrder(db, 1);

			// Reconciliation order 2 - in progress
			await createSupplierOrder(db, 3, 1, [{ isbn: "3", quantity: 1, supplier_id: 1 }]);
			await createReconciliationOrder(db, 2, [3]);

			expect(await getAllReconciliationOrders(db)).toEqual([
				{ id: 2, supplierOrderIds: [3], finalized: false, created: expect.any(Date), updatedAt: expect.any(Date) },
				{ id: 1, supplierOrderIds: [1, 2], finalized: true, created: expect.any(Date), updatedAt: expect.any(Date) }
			]);
		});

		it("sort orders based on their updatedAt value", async () => {
			const db = await getRandomDb();

			// TODO: simplify this when we remove the tedious customer order line check at supplier order creation
			//
			// NOTE: add books to customer is detached from customer existing - we can do so without creating customers
			await addBooksToCustomer(db, 1, ["1", "2", "3"]);

			// Create reconciliation order 1
			await createSupplierOrder(db, 1, 1, [{ isbn: "1", quantity: 1, supplier_id: 1 }]);
			await createSupplierOrder(db, 2, 1, [{ isbn: "2", quantity: 1, supplier_id: 1 }]);
			await createReconciliationOrder(db, 1, [1, 2]);

			// Create and finalize reconciliation order 2
			await createSupplierOrder(db, 3, 1, [{ isbn: "3", quantity: 1, supplier_id: 1 }]);
			await createReconciliationOrder(db, 2, [3]);
			await upsertReconciliationOrderLines(db, 2, [{ isbn: "3", quantity: 1 }]);
			await finalizeReconciliationOrder(db, 2);

			expect(await getAllReconciliationOrders(db)).toEqual([
				{ id: 2, supplierOrderIds: [3], finalized: true, created: expect.any(Date), updatedAt: expect.any(Date) },
				{ id: 1, supplierOrderIds: [1, 2], finalized: false, created: expect.any(Date), updatedAt: expect.any(Date) }
			]);

			// Add books to recon order 1 and finalize it (resulting in updatedAt change)
			await upsertReconciliationOrderLines(db, 1, [{ isbn: "1", quantity: 1 }]);
			await finalizeReconciliationOrder(db, 1);

			expect(await getAllReconciliationOrders(db)).toEqual([
				{ id: 1, supplierOrderIds: [1, 2], finalized: true, created: expect.any(Date), updatedAt: expect.any(Date) },
				{ id: 2, supplierOrderIds: [3], finalized: true, created: expect.any(Date), updatedAt: expect.any(Date) }
			]);
		});

		it("filter the returned orders with respect to provided 'finalized' status filter", async () => {
			const db = await getRandomDb();

			// TODO: simplify this when we remove the tedious customer order line check at supplier order creation
			//
			// NOTE: add books to customer is detached from customer existing - we can do so without creating customers
			await addBooksToCustomer(db, 1, ["1", "2", "3", "4"]);

			// NOTE: using 2 finalized and 2 in-progress reconciliation orders to test for base + 1 case
			//
			// Reconciliation order 1 - finalized
			await createSupplierOrder(db, 1, 1, [{ isbn: "1", quantity: 1, supplier_id: 1 }]);
			await createReconciliationOrder(db, 1, [1]);
			await finalizeReconciliationOrder(db, 1);

			// Reconciliation order 2 - in progress
			await createSupplierOrder(db, 2, 1, [{ isbn: "2", quantity: 1, supplier_id: 1 }]);
			await createReconciliationOrder(db, 2, [2]);

			// Reconciliation order 3 - in progress
			await createSupplierOrder(db, 3, 1, [{ isbn: "3", quantity: 1, supplier_id: 1 }]);
			await createReconciliationOrder(db, 3, [3]);

			// Reconciliation order 4 - in progress
			await createSupplierOrder(db, 4, 1, [{ isbn: "4", quantity: 1, supplier_id: 1 }]);
			await createReconciliationOrder(db, 4, [4]);
			await finalizeReconciliationOrder(db, 4);

			// Check for finalized orders
			expect(await getAllReconciliationOrders(db, { finalized: true })).toEqual([
				expect.objectContaining({ id: 4, supplierOrderIds: [4], finalized: true }),
				expect.objectContaining({ id: 1, supplierOrderIds: [1], finalized: true })
			]);

			// Check for in-progress orders
			expect(await getAllReconciliationOrders(db, { finalized: false })).toEqual([
				expect.objectContaining({ id: 3, supplierOrderIds: [3], finalized: false }),
				expect.objectContaining({ id: 2, supplierOrderIds: [2], finalized: false })
			]);
		});
	});

	describe("getReconciliation order should", () => {
		it("retrieve the reconciliation order from the DB", async () => {
			const db = await getRandomDb();

			// TODO: simplify this when we remove the tedious customer order line check at supplier order creation
			//
			// NOTE: add books to customer is detached from customer existing - we can do so without creating customers
			await addBooksToCustomer(db, 1, ["1", "2"]);
			await addBooksToCustomer(db, 2, ["1"]);

			// Reconciliation order 1 - finalized
			await createSupplierOrder(db, 1, 1, [{ isbn: "1", quantity: 1, supplier_id: 1 }]);
			await createSupplierOrder(db, 2, 1, [{ isbn: "2", quantity: 1, supplier_id: 1 }]);
			await createReconciliationOrder(db, 1, [1, 2]);
			await finalizeReconciliationOrder(db, 1);

			// Reconciliation order 2 - in progress
			await createSupplierOrder(db, 3, 1, [{ isbn: "1", quantity: 1, supplier_id: 1 }]);
			await createReconciliationOrder(db, 2, [3]);

			expect(await getReconciliationOrder(db, 1)).toEqual({
				id: 1,
				supplierOrderIds: [1, 2],
				finalized: true,
				created: expect.any(Date),
				updatedAt: expect.any(Date)
			});

			expect(await getReconciliationOrder(db, 2)).toEqual({
				id: 2,
				supplierOrderIds: [3],
				finalized: false,
				created: expect.any(Date),
				updatedAt: expect.any(Date)
			});
		});

		it("return undefined if order doesn't exist", async () => {
			const db = await getRandomDb();
			expect(await getReconciliationOrder(db, 1)).toBeUndefined();
		});
	});
});

describe("Reconciliation order lines:", () => {
	describe("upsertReconciliationOrderLines should", () => {
		it("add lines to reconciliation order", async () => {
			const db = await getRandomDb();

			// TODO: simplify this when we remove the tedious customer order line check at supplier order creation
			//
			// NOTE: add books to customer is detached from customer existing - we can do so without creating customers
			await addBooksToCustomer(db, 1, ["1", "2"]);
			await createSupplierOrder(db, 1, 1, [
				{ isbn: "1", quantity: 1, supplier_id: 1 },
				{ isbn: "2", quantity: 1, supplier_id: 1 }
			]);
			await createReconciliationOrder(db, 1, [1]);

			await upsertReconciliationOrderLines(db, 1, [{ isbn: "1", quantity: 1 }]);
			expect(await getReconciliationOrderLines(db, 1)).toEqual([expect.objectContaining({ isbn: "1", quantity: 1 })]);

			await upsertReconciliationOrderLines(db, 1, [{ isbn: "2", quantity: 1 }]);
			expect(await getReconciliationOrderLines(db, 1)).toEqual([
				expect.objectContaining({ reconciliation_order_id: 1, isbn: "1", quantity: 1 }),
				expect.objectContaining({ reconciliation_order_id: 1, isbn: "2", quantity: 1 })
			]);
		});

		it("merge quantities of lines for the same isbn", async () => {
			const db = await getRandomDb();

			// TODO: simplify this when we remove the tedious customer order line check at supplier order creation
			//
			// NOTE: add books to customer is detached from customer existing - we can do so without creating customers
			await addBooksToCustomer(db, 1, ["1", "2"]);
			await addBooksToCustomer(db, 2, ["1"]);
			await createSupplierOrder(db, 1, 1, [
				{ isbn: "1", quantity: 2, supplier_id: 1 },
				{ isbn: "2", quantity: 1, supplier_id: 1 }
			]);
			await createReconciliationOrder(db, 1, [1]);

			await upsertReconciliationOrderLines(db, 1, [
				{ isbn: "1", quantity: 1 },
				{ isbn: "2", quantity: 1 }
			]);
			await upsertReconciliationOrderLines(db, 1, [{ isbn: "1", quantity: 1 }]);

			expect(await getReconciliationOrderLines(db, 1)).toEqual([
				expect.objectContaining({ isbn: "1", quantity: 2 }),
				expect.objectContaining({ isbn: "2", quantity: 1 })
			]);
		});

		it("handle overdelivery (allow for adding of more quantity than ordered by supplier orders being reconciled)", async () => {
			const db = await getRandomDb();

			// TODO: simplify this when we remove the tedious customer order line check at supplier order creation
			//
			// NOTE: add books to customer is detached from customer existing - we can do so without creating customers
			await addBooksToCustomer(db, 1, ["1", "2"]);
			await createSupplierOrder(db, 1, 1, [
				{ isbn: "1", quantity: 2, supplier_id: 1 },
				{ isbn: "2", quantity: 1, supplier_id: 1 }
			]);
			await createReconciliationOrder(db, 1, [1]);

			await upsertReconciliationOrderLines(db, 1, [
				{ isbn: "1", quantity: 2 },
				{ isbn: "2", quantity: 1 }
			]);

			expect(await getReconciliationOrderLines(db, 1)).toEqual([
				expect.objectContaining({ isbn: "1", quantity: 2 }),
				expect.objectContaining({ isbn: "2", quantity: 1 })
			]);
		});

		it("timestamp reconciliation order's 'updatedAt' with ms precision - with each line update", async () => {
			const db = await getRandomDb();

			// TODO: simplify this when we remove the tedious customer order line check at supplier order creation
			//
			// NOTE: add books to customer is detached from customer existing - we can do so without creating customers
			await addBooksToCustomer(db, 1, ["1"]);

			await createSupplierOrder(db, 1, 1, [{ isbn: "1", quantity: 1, supplier_id: 1 }]);
			await createReconciliationOrder(db, 1, [1]);

			const reconOrder = await getReconciliationOrder(db, 1);
			expect(Date.now() - reconOrder.updatedAt.getTime()).toBeLessThan(400);

			await upsertReconciliationOrderLines(db, 1, [{ isbn: "1", quantity: 1 }]);
			const reconOrderUpdated = await getReconciliationOrder(db, 1);
			expect(reconOrderUpdated.updatedAt > reconOrder.updatedAt).toBe(true);
			expect(Date.now() - reconOrderUpdated.updatedAt.getTime()).toBeLessThan(400);
		});

		it("throw an error if reconciliation order doesn't exist", async () => {
			const db = await getRandomDb();

			await expect(upsertReconciliationOrderLines(db, 1, [{ isbn: "1", quantity: 1 }])).rejects.toThrow(
				new ErrReconciliationOrderNotFound(1)
			);
		});

		it("throw an error if trying to add lines to a finalized reconciliation order", async () => {
			const db = await getRandomDb();

			// TODO: simplify this when we remove the tedious customer order line check at supplier order creation
			//
			// NOTE: add books to customer is detached from customer existing - we can do so without creating customers
			await addBooksToCustomer(db, 1, ["1"]);

			await createSupplierOrder(db, 1, 1, [{ isbn: "1", quantity: 1, supplier_id: 1 }]);
			await createReconciliationOrder(db, 1, [1]);
			await finalizeReconciliationOrder(db, 1);

			await expect(upsertReconciliationOrderLines(db, 1, [{ isbn: "1", quantity: 1 }])).rejects.toThrow(
				new ErrReconciliationOrderFinalized(1, [{ isbn: "1", quantity: 1 }])
			);
		});

		it("should correctly handle negative quantities to decrease existing line quantities", async () => {
			const db = await getRandomDb();

			await addBooksToCustomer(db, 1, ["1"]);
			await createSupplierOrder(db, 1, 1, [{ isbn: "1", quantity: 1, supplier_id: 1 }]);
			await createReconciliationOrder(db, 1, [1]);

			// Add initial quantity
			await upsertReconciliationOrderLines(db, 1, [{ isbn: "1", quantity: 3 }]);

			// Verify initial state
			let lines = await getReconciliationOrderLines(db, 1);
			expect(lines[0].quantity).toBe(3);

			// Decrease quantity
			await upsertReconciliationOrderLines(db, 1, [{ isbn: "1", quantity: -2 }]);

			// Verify updated quantity
			lines = await getReconciliationOrderLines(db, 1);
			expect(lines[0].quantity).toBe(1);
		});

		it("should remove line when quantity is reduced to zero", async () => {
			const db = await getRandomDb();

			await addBooksToCustomer(db, 1, ["1"]);
			await createSupplierOrder(db, 1, 1, [{ isbn: "1", quantity: 1, supplier_id: 1 }]);
			await createReconciliationOrder(db, 1, [1]);

			// Add initial quantity
			await upsertReconciliationOrderLines(db, 1, [{ isbn: "1", quantity: 2 }]);

			// Reduce to zero
			await upsertReconciliationOrderLines(db, 1, [{ isbn: "1", quantity: -2 }]);

			// Verify line is removed
			const lines = await getReconciliationOrderLines(db, 1);
			expect(lines).toHaveLength(0);
		});
	});

	describe("getReconciliationOrderLines should", () => {
		it("retrieve reconciliation order lines for a particular reconciliation order", async () => {
			const db = await getRandomDb();

			await addBooksToCustomer(db, 1, ["1", "2", "3"]);
			await createSupplierOrder(db, 1, 1, [
				{ isbn: "1", quantity: 1, supplier_id: 1 },
				{ isbn: "2", quantity: 1, supplier_id: 1 }
			]);
			await createReconciliationOrder(db, 1, [1]);
			await upsertReconciliationOrderLines(db, 1, [
				{ isbn: "1", quantity: 1 },
				{ isbn: "2", quantity: 1 }
			]);

			// Create another reconciliation order (to make sure the distinction is made)
			await createSupplierOrder(db, 2, 1, [{ isbn: "3", quantity: 1, supplier_id: 1 }]);
			await createReconciliationOrder(db, 2, [2]);
			await upsertReconciliationOrderLines(db, 2, [{ isbn: "3", quantity: 1 }]);

			expect(await getReconciliationOrderLines(db, 1)).toEqual([
				expect.objectContaining({ reconciliation_order_id: 1, isbn: "1", quantity: 1 }),
				expect.objectContaining({ reconciliation_order_id: 1, isbn: "2", quantity: 1 })
			]);

			expect(await getReconciliationOrderLines(db, 2)).toEqual([
				expect.objectContaining({ reconciliation_order_id: 2, isbn: "3", quantity: 1 })
			]);
		});

		it("retrieve order line's meta data (if available)", async () => {
			const db = await getRandomDb();

			await upsertBook(db, {
				isbn: "1",
				title: "The (Mis)behavior of Markets",
				authors: "Benoit Mandelbrot",
				publisher: "Basic Books",
				price: 10
			});
			await addBooksToCustomer(db, 1, ["1"]);
			await createSupplierOrder(db, 1, 1, [{ isbn: "1", quantity: 1, supplier_id: 1 }]);
			await createReconciliationOrder(db, 1, [1]);
			await upsertReconciliationOrderLines(db, 1, [{ isbn: "1", quantity: 1 }]);

			expect(await getReconciliationOrderLines(db, 1)).toEqual([
				{
					reconciliation_order_id: 1,
					isbn: "1",
					quantity: 1,
					title: "The (Mis)behavior of Markets",
					authors: "Benoit Mandelbrot",
					publisher: "Basic Books",
					price: 10
				}
			]);
		});

		it("provide fallbacks if book data not available", async () => {
			const db = await getRandomDb();

			await addBooksToCustomer(db, 1, ["1"]);
			await createSupplierOrder(db, 1, 1, [{ isbn: "1", quantity: 1, supplier_id: 1 }]);
			await createReconciliationOrder(db, 1, [1]);
			await upsertReconciliationOrderLines(db, 1, [{ isbn: "1", quantity: 1 }]);

			expect(await getReconciliationOrderLines(db, 1)).toEqual([
				{
					reconciliation_order_id: 1,
					isbn: "1",
					quantity: 1,
					title: "N/A",
					authors: "N/A",
					publisher: "N/A",
					price: 0
				}
			]);
		});

		it("throw an error if reconciliation order doesn't exist", async () => {
			const db = await getRandomDb();
			expect(getReconciliationOrderLines(db, 1)).rejects.toThrow(new ErrReconciliationOrderNotFound(1));
		});
	});
});

describe("Reconciliation order finalization:", () => {
	describe("finalizeReconciliationOrder should", async () => {
		it("finalize a reconciling order with single book (base case)", async () => {
			const db = await getRandomDb();

			await upsertCustomer(db, { id: 1, displayId: "1" });
			await addBooksToCustomer(db, 1, ["1", "2", "3"]);

			await createSupplierOrder(db, 1, 1, [{ isbn: "1", quantity: 1, supplier_id: 1 }]);

			await createReconciliationOrder(db, 1, [1]);
			await upsertReconciliationOrderLines(db, 1, [{ isbn: "1", quantity: 1 }]);

			await finalizeReconciliationOrder(db, 1);
			expect(await getReconciliationOrder(db, 1)).toMatchObject({
				id: 1,
				supplierOrderIds: [1],
				finalized: true
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

			await createSupplierOrder(db, 1, 1, [
				{ isbn: "1", quantity: 1, supplier_id: 1 },
				{ isbn: "2", quantity: 1, supplier_id: 1 }
			]);

			await createReconciliationOrder(db, 1, [1]);
			await upsertReconciliationOrderLines(db, 1, [
				{ isbn: "1", quantity: 1 },
				{ isbn: "2", quantity: 1 }
			]);

			await finalizeReconciliationOrder(db, 1);

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

			await createSupplierOrder(db, 1, 1, [{ isbn: "1", quantity: 2, supplier_id: 1 }]);

			await createReconciliationOrder(db, 1, [1]);
			await upsertReconciliationOrderLines(db, 1, [{ isbn: "1", quantity: 2 }]);

			await finalizeReconciliationOrder(db, 1);

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

			await createSupplierOrder(db, 1, 1, [{ isbn: "1", quantity: 3, supplier_id: 1 }]);

			await createReconciliationOrder(db, 1, [1]);
			await upsertReconciliationOrderLines(db, 1, [{ isbn: "1", quantity: 2 }]);

			await finalizeReconciliationOrder(db, 1);

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

			await createSupplierOrder(db, 1, 1, [{ isbn: "1", quantity: 2, supplier_id: 1 }]);
			await createSupplierOrder(db, 2, 1, [{ isbn: "1", quantity: 1, supplier_id: 1 }]);

			await createReconciliationOrder(db, 1, [2]);
			// Technically, the 1 book received was ordered for customer 3, but customer 1 had ordered 1st and they don't have their book yet
			await upsertReconciliationOrderLines(db, 1, [{ isbn: "1", quantity: 1 }]);

			await finalizeReconciliationOrder(db, 1);

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
			// Not placed (pending) - putting this here to make sure it doesn't affect rejection:
			// even though last 'created', it's not placed yet - the customer 3's order should be rejected
			await addBooksToCustomer(db, 4, ["1"]);

			await createSupplierOrder(db, 1, 1, [{ isbn: "1", quantity: 2, supplier_id: 1 }]);
			await createSupplierOrder(db, 2, 1, [{ isbn: "1", quantity: 1, supplier_id: 1 }]);

			await createReconciliationOrder(db, 1, [1]);
			// Out of 2 books, only 1 arrived - 1 to reconcile (mark as received), 1 to reject (effectively marking as waiting to be re-ordered)
			await upsertReconciliationOrderLines(db, 1, [{ isbn: "1", quantity: 1 }]);
			await finalizeReconciliationOrder(db, 1);

			expect(await getCustomerOrderLines(db, 1)).toEqual([
				expect.objectContaining({ isbn: "1", placed: expect.any(Date), received: expect.any(Date) })
			]);
			expect(await getCustomerOrderLines(db, 2)).toEqual([
				expect.objectContaining({ isbn: "1", placed: expect.any(Date), received: undefined })
			]);
			// Even though customer order line 3 was not placed as part of the supplier order being reconciled, it was rejected by 1 book missing from the order
			expect(await getCustomerOrderLines(db, 3)).toEqual([expect.objectContaining({ isbn: "1", placed: undefined, received: undefined })]);
			// Not changed - control variable
			expect(await getCustomerOrderLines(db, 4)).toEqual([expect.objectContaining({ isbn: "1", placed: undefined, received: undefined })]);
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

			await createSupplierOrder(db, 1, 1, [{ isbn: "1", quantity: 2, supplier_id: 1 }]);
			await createSupplierOrder(db, 2, 1, [{ isbn: "1", quantity: 2, supplier_id: 1 }]);

			await createReconciliationOrder(db, 1, [1]);
			await upsertReconciliationOrderLines(db, 1, [{ isbn: "1", quantity: 3 }]);

			await finalizeReconciliationOrder(db, 1);

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

			await createSupplierOrder(db, 1, 1, [{ isbn: "1", quantity: 2, supplier_id: 1 }]);

			await createReconciliationOrder(db, 1, [1]);
			await upsertReconciliationOrderLines(db, 1, [{ isbn: "1", quantity: 3 }]);

			await finalizeReconciliationOrder(db, 1);

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

			await createSupplierOrder(db, 1, 1, [
				{ isbn: "1", quantity: 2, supplier_id: 1 },
				{ isbn: "2", quantity: 2, supplier_id: 1 },
				{ isbn: "3", quantity: 1, supplier_id: 1 }
			]);
			await createSupplierOrder(db, 2, 1, [
				{ isbn: "1", quantity: 1, supplier_id: 1 },
				{ isbn: "3", quantity: 1, supplier_id: 1 }
			]);

			await createReconciliationOrder(db, 1, [1, 2]);
			await upsertReconciliationOrderLines(db, 1, [
				{ isbn: "1", quantity: 3 },
				{ isbn: "2", quantity: 2 },
				{ isbn: "3", quantity: 2 }
			]);

			await finalizeReconciliationOrder(db, 1);

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

			await createSupplierOrder(db, 1, 1, [
				{ isbn: "1", quantity: 2, supplier_id: 1 },
				{ isbn: "2", quantity: 2, supplier_id: 1 },
				{ isbn: "3", quantity: 1, supplier_id: 1 }
			]);
			await createSupplierOrder(db, 2, 1, [
				{ isbn: "1", quantity: 1, supplier_id: 1 },
				{ isbn: "3", quantity: 1, supplier_id: 1 }
			]);

			await createReconciliationOrder(db, 1, [1, 2]);
			await upsertReconciliationOrderLines(db, 1, [
				{ isbn: "1", quantity: 1 },
				{ isbn: "3", quantity: 2 }
			]);

			await finalizeReconciliationOrder(db, 1);

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
		//
		// NOTE: At the time of writing, there was no early reconciliation logic (in case of overdelivery).
		// This becomes obsolete in that case, but it might be useful as a TODO to test out (and implement) the
		// functionality that should be in place for overdelivery without additional customer order lines to reconcile.
		it("not explode if quantity delivered exceeds quantity ordered", async () => {
			const db = await getRandomDb();

			await upsertCustomer(db, { id: 1, displayId: "1" });
			await upsertCustomer(db, { id: 2, displayId: "2" });

			await addBooksToCustomer(db, 1, ["1"]);
			await addBooksToCustomer(db, 2, ["1"]);

			await createSupplierOrder(db, 1, 1, [{ isbn: "1", quantity: 2, supplier_id: 1 }]);

			await createReconciliationOrder(db, 1, [1]);
			await upsertReconciliationOrderLines(db, 1, [
				{ isbn: "1", quantity: 3 } // only 2 ordered
			]);

			await finalizeReconciliationOrder(db, 1);
			expect(await getReconciliationOrder(db, 1)).toMatchObject({
				id: 1,
				supplierOrderIds: [1],
				finalized: true
			});

			expect(await getCustomerOrderLines(db, 1)).toEqual([expect.objectContaining({ isbn: "1", received: expect.any(Date) })]);
			expect(await getCustomerOrderLines(db, 2)).toEqual([expect.objectContaining({ isbn: "1", received: expect.any(Date) })]);
		});

		// NOTE: This is the current implementation, maybe we want it to, in fact, explode in these cases
		it("not explode if a delivered book was never ordered", async () => {
			const db = await getRandomDb();

			await upsertCustomer(db, { id: 1, displayId: "1" });

			await addBooksToCustomer(db, 1, ["1"]);

			await createSupplierOrder(db, 1, 1, [{ isbn: "1", quantity: 1, supplier_id: 1 }]);
			await createReconciliationOrder(db, 1, [1]);
			await upsertReconciliationOrderLines(db, 1, [
				{ isbn: "1", quantity: 1 },
				{ isbn: "2", quantity: 1 } // was never ordered
			]);

			await finalizeReconciliationOrder(db, 1);
			expect(await getReconciliationOrder(db, 1)).toMatchObject({
				id: 1,
				supplierOrderIds: [1],
				finalized: true
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
			await createSupplierOrder(db, 1, 1, [
				{ isbn: "1", quantity: 1, supplier_id: 1 }, // Placed, but won't be delivered
				{ isbn: "2", quantity: 1, supplier_id: 1 }
			]);
			await createReconciliationOrder(db, 1, [1]);
			await upsertReconciliationOrderLines(db, 1, [{ isbn: "2", quantity: 1 }]);
			await finalizeReconciliationOrder(db, 1);

			expect(await getCustomerOrderLines(db, 1)).toEqual([
				expect.objectContaining({ isbn: "1", received: undefined }),
				expect.objectContaining({ isbn: "2", received: expect.any(Date) })
			]);

			// Order ISBN 1 for customer 2
			await addBooksToCustomer(db, 2, ["1"]);

			// Place the order with the supplier again
			await createSupplierOrder(db, 2, 1, [{ isbn: "1", quantity: 2, supplier_id: 1 }]);

			// Only one delivered copy - should end up with customer 1
			await createReconciliationOrder(db, 2, [2]);
			await upsertReconciliationOrderLines(db, 2, [{ isbn: "1", quantity: 1 }]);
			await finalizeReconciliationOrder(db, 2);

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
			await createSupplierOrder(db, 1, 1, [
				{ isbn: "1", quantity: 1, supplier_id: 1 }, // Placed, but won't be delivered
				{ isbn: "2", quantity: 1, supplier_id: 1 }
			]);

			// Place an order for the second customer - 2nd supplier order
			await addBooksToCustomer(db, 2, ["1"]);
			await createSupplierOrder(db, 2, 1, [{ isbn: "1", quantity: 1, supplier_id: 1 }]);

			await createReconciliationOrder(db, 1, [1]);
			await upsertReconciliationOrderLines(db, 1, [{ isbn: "2", quantity: 1 }]);
			await finalizeReconciliationOrder(db, 1);

			// Re-order the ISBN 1 for customer 1 - 3rd supplier order
			await createSupplierOrder(db, 3, 1, [{ isbn: "1", quantity: 1, supplier_id: 1 }]);
			await createReconciliationOrder(db, 2, [2, 3]);
			await upsertReconciliationOrderLines(db, 2, [{ isbn: "1", quantity: 1 }]);
			await finalizeReconciliationOrder(db, 2);

			expect(await getCustomerOrderLines(db, 1)).toEqual([
				expect.objectContaining({ isbn: "1", received: expect.any(Date) }),
				expect.objectContaining({ isbn: "2", received: expect.any(Date) })
			]);
			expect(await getCustomerOrderLines(db, 2)).toEqual([expect.objectContaining({ isbn: "1", received: undefined })]);
		});

		it("mark customer order lines' 'received' timestamp with ms precision", async () => {
			const db = await getRandomDb();

			await addBooksToCustomer(db, 1, ["1", "2"]);
			await createSupplierOrder(db, 1, 1, [{ isbn: "1", quantity: 1, supplier_id: 1 }]);
			await createReconciliationOrder(db, 1, [1]);
			await upsertReconciliationOrderLines(db, 1, [{ isbn: "1", quantity: 1 }]);
			await finalizeReconciliationOrder(db, 1);

			const [orderLine1] = await getCustomerOrderLines(db, 1);
			expect(Date.now() - orderLine1.received.getTime()).toBeLessThan(100);

			await createSupplierOrder(db, 2, 1, [{ isbn: "2", quantity: 1, supplier_id: 1 }]);
			await createReconciliationOrder(db, 2, [2]);
			await upsertReconciliationOrderLines(db, 2, [{ isbn: "2", quantity: 1 }]);
			await finalizeReconciliationOrder(db, 2);

			const [, orderLine2] = await getCustomerOrderLines(db, 1);
			expect(Date.now() - orderLine2.received.getTime()).toBeLessThan(100);
		});

		it("throw an error if reconciliation order not found", async () => {
			const db = await getRandomDb();
			await expect(finalizeReconciliationOrder(db, 1)).rejects.toThrow(new ErrReconciliationOrderNotFound(1));
		});

		it("throw an error if trying to reconcile an already reconciled order", async () => {
			const db = await getRandomDb();

			await addBooksToCustomer(db, 1, ["1"]);
			await createSupplierOrder(db, 1, 1, [{ isbn: "1", quantity: 1, supplier_id: 1 }]);
			await createReconciliationOrder(db, 1, [1]);
			await upsertReconciliationOrderLines(db, 1, [{ isbn: "1", quantity: 1 }]);
			await finalizeReconciliationOrder(db, 1);

			await expect(finalizeReconciliationOrder(db, 1)).rejects.toThrow(new ErrReconciliationOrderFinalized(1));
		});
	});
});

describe("Reconciliation order deletion", () => {
	describe("deleteReconciliationOrder", () => {
		it("should delete a reconciliation order and its associated lines", async () => {
			const db = await getRandomDb();

			await addBooksToCustomer(db, 1, ["1", "2"]);
			await createSupplierOrder(db, 1, 1, [{ isbn: "1", quantity: 1, supplier_id: 1 }]);
			await createSupplierOrder(db, 2, 1, [{ isbn: "2", quantity: 1, supplier_id: 1 }]);

			const [order1, order2] = await getPlacedSupplierOrders(db);

			// Create first reconciliation order with lines
			const reconciliationOrderId = 123;
			await createReconciliationOrder(db, reconciliationOrderId, [order1.id]);
			await upsertReconciliationOrderLines(db, reconciliationOrderId, [
				{ isbn: "1", quantity: 2 },
				{ isbn: "2", quantity: 1 }
			]);

			// Create second reconciliation order with lines (should remain untouched)
			const otherReconciliationOrderId = 456;
			await createReconciliationOrder(db, otherReconciliationOrderId, [order2.id]);
			await upsertReconciliationOrderLines(db, otherReconciliationOrderId, [{ isbn: "2", quantity: 3 }]);

			// Delete the first reconciliation order
			await deleteReconciliationOrder(db, reconciliationOrderId);

			// Verify first order is deleted
			expect(await getReconciliationOrder(db, reconciliationOrderId)).toBeUndefined();

			// Verify first order's lines are deleted by directly checking the table
			const remainingLines = await db.execO("SELECT * FROM reconciliation_order_lines WHERE reconciliation_order_id  = ?;", [
				reconciliationOrderId
			]);
			expect(remainingLines).toHaveLength(0);

			// Verify getReconciliationOrderLines fails appropriately for deleted orde
			await expect(getReconciliationOrderLines(db, reconciliationOrderId)).rejects.toThrow(
				new ErrReconciliationOrderNotFound(reconciliationOrderId)
			);

			// Verify second order and its lines are unaffected
			const otherOrder = await getReconciliationOrder(db, otherReconciliationOrderId);
			expect(otherOrder).toBeDefined();
			expect(otherOrder.supplierOrderIds).toEqual([order2.id]);

			const otherOrderLines = await getReconciliationOrderLines(db, otherReconciliationOrderId);
			expect(otherOrderLines).toEqual([
				expect.objectContaining({
					reconciliation_order_id: otherReconciliationOrderId,
					isbn: "2",
					quantity: 3
				})
			]);
		});

		it("should throw error when trying to delete non-existent order", async () => {
			const db = await getRandomDb();

			const nonExistentId = 999;
			await expect(deleteReconciliationOrder(db, nonExistentId)).rejects.toThrow(new ErrReconciliationOrderNotFound(nonExistentId));
		});
		it("should allow supplier orders to be reconciled again after deletion", async () => {
			const db = await getRandomDb();

			// Create supplier order
			await addBooksToCustomer(db, 1, ["1"]);

			await createSupplierOrder(db, 1, 1, [{ isbn: "1", quantity: 1, supplier_id: 1 }]);
			const [{ id: supplierOrderId }] = await getPlacedSupplierOrders(db);

			const reconciliationOrderId = 123;

			// Create first reconciliation order
			await createReconciliationOrder(db, reconciliationOrderId, [supplierOrderId]);
			await upsertReconciliationOrderLines(db, reconciliationOrderId, [{ isbn: "1", quantity: 1 }]);

			const supplierOrdersBefore = await getPlacedSupplierOrders(db, { supplierId: 1, reconciled: false });
			expect(supplierOrdersBefore).toEqual([]);

			// Delete the reconciliation order
			await deleteReconciliationOrder(db, reconciliationOrderId);

			const reconciliationOrder2Id = 1234;
			const supplierOrders = await getPlacedSupplierOrders(db, { supplierId: 1, reconciled: false });
			expect(supplierOrders).toEqual([
				{
					created: expect.any(Number),
					id: 1,
					supplier_id: 1,
					supplier_name: null,
					total_book_number: 1,
					total_book_price: 0,
					reconciliation_order_id: null,
					// There is no associated reconciliation order => no updatedAt
					reconciliation_last_updated_at: null
				}
			]);

			// Verify we can create a new reconciliation order with the same
			// supplier order
			await createReconciliationOrder(db, reconciliationOrder2Id, [supplierOrderId]);
			await upsertReconciliationOrderLines(db, reconciliationOrder2Id, [{ isbn: "1", quantity: 1 }]);

			const newOrder = await getReconciliationOrder(db, reconciliationOrder2Id);
			expect(newOrder).toBeDefined();
			expect(newOrder.supplierOrderIds).toContain(supplierOrderId);
		});

		it("should not allow deletion of finalized orders", async () => {
			const db = await getRandomDb();

			// Create supplier order
			await addBooksToCustomer(db, 1, ["1"]);
			await createSupplierOrder(db, 1, 1, [{ isbn: "1", quantity: 1, supplier_id: 1 }]);
			const [{ id: supplierOrderId }] = await getPlacedSupplierOrders(db);

			const reconciliationOrderId = 123;

			// Create and finalize reconciliation order
			await createReconciliationOrder(db, reconciliationOrderId, [supplierOrderId]);
			await upsertReconciliationOrderLines(db, reconciliationOrderId, [{ isbn: "1", quantity: 1 }]);
			await finalizeReconciliationOrder(db, reconciliationOrderId);

			// Attempt to delete finalized order
			await expect(deleteReconciliationOrder(db, reconciliationOrderId)).rejects.toThrow(
				new ErrReconciliationOrderFinalized(reconciliationOrderId)
			);
		});
	});
	describe("deleteOrderLineFromReconciliationOrder", () => {
		it("should delete a specific order line from reconciliation order", async () => {
			const db = await getRandomDb();

			// Create supplier order
			await addBooksToCustomer(db, 1, ["1"]);

			await createSupplierOrder(db, 1, 1, [{ isbn: "1", quantity: 1, supplier_id: 1 }]);
			const [{ id: supplierOrderId }] = await getPlacedSupplierOrders(db);

			// Create reconciliation order
			const reconciliationOrderId = 123;
			await createReconciliationOrder(db, reconciliationOrderId, [supplierOrderId]);
			await upsertReconciliationOrderLines(db, reconciliationOrderId, [
				{ isbn: "1", quantity: 2 },
				{ isbn: "2", quantity: 1 }
			]);

			// Get initial state
			const initialLines = await getReconciliationOrderLines(db, reconciliationOrderId);
			expect(initialLines).toHaveLength(2);

			// Delete one line
			await deleteOrderLineFromReconciliationOrder(db, reconciliationOrderId, "1");

			// Verify deletion
			const remainingLines = await getReconciliationOrderLines(db, reconciliationOrderId);
			expect(remainingLines).toHaveLength(1);
			expect(remainingLines[0].isbn).toBe("2");
		});

		it("should update the reconciliation order's timestamp when deleting a line", async () => {
			const db = await getRandomDb();

			// Create supplier order
			await addBooksToCustomer(db, 1, ["1"]);
			await createSupplierOrder(db, 1, 1, [{ isbn: "1", quantity: 1, supplier_id: 1 }]);
			const [{ id: supplierOrderId }] = await getPlacedSupplierOrders(db);

			// Create reconciliation order
			const reconciliationOrderId = 123;

			await createReconciliationOrder(db, reconciliationOrderId, [supplierOrderId]);
			await upsertReconciliationOrderLines(db, reconciliationOrderId, [{ isbn: "1", quantity: 1 }]);

			// Get initial timestamp
			const initialOrder = await getReconciliationOrder(db, reconciliationOrderId);
			const initialTimestamp = initialOrder.updatedAt;

			// Wait a bit to ensure timestamp difference
			await new Promise((resolve) => setTimeout(resolve, 100));

			// Delete the line
			await deleteOrderLineFromReconciliationOrder(db, reconciliationOrderId, "1");

			// Check updated timestamp
			const updatedOrder = await getReconciliationOrder(db, reconciliationOrderId);
			expect(updatedOrder.updatedAt.getTime()).toBeGreaterThan(initialTimestamp.getTime());
		});

		it("should update the reconciliation order's timestamp on finalization", async () => {
			const db = await getRandomDb();

			// Create supplier order
			await addBooksToCustomer(db, 1, ["1"]);
			await createSupplierOrder(db, 1, 1, [{ isbn: "1", quantity: 1, supplier_id: 1 }]);
			const [{ id: supplierOrderId }] = await getPlacedSupplierOrders(db);

			// Create reconciliation order
			const reconciliationOrderId = 123;

			await createReconciliationOrder(db, reconciliationOrderId, [supplierOrderId]);
			await upsertReconciliationOrderLines(db, reconciliationOrderId, [{ isbn: "1", quantity: 1 }]);

			// Get initial timestamp
			const initialOrder = await getReconciliationOrder(db, reconciliationOrderId);
			const initialTimestamp = initialOrder.updatedAt;

			// Wait a bit to ensure timestamp difference
			await new Promise((resolve) => setTimeout(resolve, 100));

			// Finalize the order
			await finalizeReconciliationOrder(db, reconciliationOrderId);

			// Check updated timestamp
			const updatedOrder = await getReconciliationOrder(db, reconciliationOrderId);
			expect(updatedOrder.updatedAt.getTime()).toBeGreaterThan(initialTimestamp.getTime());
		});

		it("should throw error when reconciliation order doesn't exist", async () => {
			const db = await getRandomDb();

			const nonExistentId = 999;
			await expect(deleteOrderLineFromReconciliationOrder(db, nonExistentId, "1")).rejects.toThrow(
				new ErrReconciliationOrderNotFound(nonExistentId)
			);
		});

		it("should throw when deleting non-existent ISBN from valid order", async () => {
			const db = await getRandomDb();

			// Create supplier order
			await addBooksToCustomer(db, 1, ["1"]);
			await createSupplierOrder(db, 1, 1, [{ isbn: "1", quantity: 1, supplier_id: 1 }]);
			const [{ id: supplierOrderId }] = await getPlacedSupplierOrders(db);

			// Create reconciliation order
			const reconciliationOrderId = 123;

			await createReconciliationOrder(db, reconciliationOrderId, [supplierOrderId]);
			await upsertReconciliationOrderLines(db, reconciliationOrderId, [{ isbn: "1", quantity: 1 }]);

			// Should not throw when deleting non-existent ISBN
			await expect(deleteOrderLineFromReconciliationOrder(db, reconciliationOrderId, "999")).rejects.toThrow(
				"No matching order line found"
			);

			// Verify original line does not exist
			const remainingLines = await getReconciliationOrderLines(db, reconciliationOrderId);
			expect(remainingLines).toHaveLength(1);
			expect(remainingLines[0].isbn).toBe("1");
		});

		it("should not allow deletion from finalized orders", async () => {
			const db = await getRandomDb();

			// Create supplier order
			await addBooksToCustomer(db, 1, ["1"]);
			await createSupplierOrder(db, 1, 1, [{ isbn: "1", quantity: 1, supplier_id: 1 }]);
			const [{ id: supplierOrderId }] = await getPlacedSupplierOrders(db);

			// Create and finalize reconciliation order
			const reconciliationOrderId = 123;

			await createReconciliationOrder(db, reconciliationOrderId, [supplierOrderId]);
			await upsertReconciliationOrderLines(db, reconciliationOrderId, [{ isbn: "1", quantity: 1 }]);
			await finalizeReconciliationOrder(db, reconciliationOrderId);

			// Attempt to delete from finalized order should throw
			await expect(deleteOrderLineFromReconciliationOrder(db, reconciliationOrderId, "1")).rejects.toThrow(
				new ErrReconciliationOrderFinalized(reconciliationOrderId)
			);
		});
	});
});
