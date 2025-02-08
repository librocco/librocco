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
import { getCustomerOrderLines } from "../customers";

import {} from "../order-reconciliation";

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
				created: expect.any(Number),
				updatedAt: expect.any(Number)
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
