import { describe, expect, it, vi, afterEach } from "vitest";

import { processOrderDelivery, type ReconciliationProcessedLine, type ReconciliationUnmatchedBookLine } from "../utils";
import { orderFormats } from "$lib/enums/orders";
import type { PlacedSupplierOrderLine } from "$lib/db/cr-sqlite/types";

describe("processOrderDelivery should", () => {
	afterEach(() => {
		vi.clearAllMocks();
	});

	it("process when delivery matches order exactly", () => {
		const scannedBooks = [{ isbn: "123", title: "Book 1", authors: "Author 1", price: 10, quantity: 2 }];

		const placedOrderLines: PlacedSupplierOrderLine[] = [
			{
				isbn: "123",
				title: "Book 1",
				authors: "Author 1",
				line_price: 10,
				quantity: 2,
				supplier_name: "Supplier 1",
				supplier_id: 1,
				total_book_number: 1,
				supplier_order_id: 1,
				total_book_price: 10,
				created: Date.now(),
				orderFormat: orderFormats.PBM,
				customerId: 2
			}
		];

		const processedLine: ReconciliationProcessedLine = {
			isbn: "123",
			title: "Book 1",
			authors: "Author 1",
			supplier_name: "Supplier 1",
			supplier_id: 1,
			deliveredQuantity: 2,
			orderedQuantity: 2
		};
		const result = processOrderDelivery(scannedBooks, placedOrderLines);
		expect(result).toEqual({
			processedLines: [processedLine],
			unmatchedBooks: []
		});
	});

	it("increment both order lines when two supplier orders are being reconciled containing the same isbn", () => {
		const scannedBooks = [{ isbn: "123", title: "Book 1", authors: "Author 1", price: 10, quantity: 2 }];

		const placedOrderLines: PlacedSupplierOrderLine[] = [
			{
				isbn: "123",
				title: "Book 1",
				authors: "Author 1",
				line_price: 10,
				quantity: 1,
				supplier_name: "Supplier 1",
				supplier_id: 1,
				total_book_number: 1,
				supplier_order_id: 1,
				total_book_price: 10,
				created: Date.now(),
				orderFormat: orderFormats.PBM,
				customerId: 2
			},
			{
				isbn: "123",
				title: "Book 1",
				authors: "Author 1",
				line_price: 10,
				quantity: 1,
				supplier_name: "Supplier 2",
				supplier_id: 1,
				total_book_number: 1,
				supplier_order_id: 2,
				total_book_price: 10,
				created: Date.now(),
				orderFormat: orderFormats.PBM,
				customerId: 2
			}
		];

		const result = processOrderDelivery(scannedBooks, placedOrderLines);
		const processedLines: ReconciliationProcessedLine[] = [
			{
				isbn: "123",
				title: "Book 1",
				authors: "Author 1",
				supplier_name: "Supplier 1",
				supplier_id: 1,
				deliveredQuantity: 1,
				orderedQuantity: 1
			},
			{
				isbn: "123",
				title: "Book 1",
				authors: "Author 1",
				supplier_name: "Supplier 2",
				supplier_id: 1,
				deliveredQuantity: 1,
				orderedQuantity: 1
			}
		];
		expect(result).toEqual({
			processedLines: processedLines,
			unmatchedBooks: []
		});
	});

	it("handle partial delivery", () => {
		const scannedBooks = [{ isbn: "123", title: "Book 1", authors: "Author 1", price: 10, quantity: 1 }];

		const placedOrderLines: PlacedSupplierOrderLine[] = [
			{
				isbn: "123",
				title: "Book 1",
				authors: "Author 1",
				line_price: 10,
				quantity: 2,
				supplier_name: "Supplier 1",
				supplier_id: 1,
				total_book_number: 1,
				supplier_order_id: 1,
				total_book_price: 10,
				created: Date.now(),
				orderFormat: orderFormats.PBM,
				customerId: 2
			}
		];

		const processedLine: ReconciliationProcessedLine = {
			isbn: "123",
			title: "Book 1",
			authors: "Author 1",
			supplier_name: "Supplier 1",
			supplier_id: 1,
			deliveredQuantity: 1,
			orderedQuantity: 2
		};
		const result = processOrderDelivery(scannedBooks, placedOrderLines);
		expect(result).toEqual({
			processedLines: [processedLine],
			unmatchedBooks: []
		});
	});

	it("handle over-delivery", () => {
		const scannedBooks = [{ isbn: "123", title: "Book 1", authors: "Author 1", price: 10, quantity: 3 }];

		const processedLine: ReconciliationProcessedLine = {
			isbn: "123",
			title: "Book 1",
			authors: "Author 1",

			supplier_name: "Supplier 1",

			supplier_id: 1,

			deliveredQuantity: 2,
			orderedQuantity: 2
		};
		const placedOrderLines: PlacedSupplierOrderLine[] = [
			{
				isbn: "123",
				title: "Book 1",
				authors: "Author 1",
				line_price: 10,
				quantity: 2,
				supplier_name: "Supplier 1",
				supplier_id: 1,
				total_book_number: 1,
				supplier_order_id: 1,
				total_book_price: 10,
				created: Date.now(),
				orderFormat: orderFormats.PBM,
				customerId: 2
			}
		];

		const unmatchedBook: ReconciliationUnmatchedBookLine = {
			isbn: "123",
			title: "Book 1",
			authors: "Author 1",
			price: 10,
			deliveredQuantity: 1,
			orderedQuantity: 0
		};
		const result = processOrderDelivery(scannedBooks, placedOrderLines);
		expect(result).toEqual({
			processedLines: [processedLine],
			unmatchedBooks: [unmatchedBook]
		});
	});

	it("handle unordered books", () => {
		const scannedBooks = [{ isbn: "456", title: "Book 2", authors: "Author 2", price: 15, quantity: 2 }];

		const placedOrderLines: PlacedSupplierOrderLine[] = [
			{
				isbn: "123",
				title: "Book 1",
				authors: "Author 1",
				line_price: 10,
				quantity: 2,
				supplier_name: "Supplier 1",
				supplier_id: 1,
				total_book_number: 1,
				supplier_order_id: 1,
				total_book_price: 10,
				created: Date.now(),
				orderFormat: orderFormats.PBM,
				customerId: 2
			}
		];

		const result = processOrderDelivery(scannedBooks, placedOrderLines);
		const processedLine: ReconciliationProcessedLine = {
			authors: "Author 1",
			isbn: "123",
			supplier_id: 1,
			supplier_name: "Supplier 1",
			title: "Book 1",
			deliveredQuantity: 0,
			orderedQuantity: 2
		};
		const unmatchedBook: ReconciliationUnmatchedBookLine = {
			authors: "Author 2",
			isbn: "456",
			price: 15,
			title: "Book 2",
			deliveredQuantity: 2,
			orderedQuantity: 0
		};
		expect(result).toEqual({
			processedLines: [expect.objectContaining(processedLine)],
			unmatchedBooks: [unmatchedBook]
		});
	});

	it("handle under-delivery", () => {
		const scannedBooks = [];

		const placedOrderLines: PlacedSupplierOrderLine[] = [
			{
				isbn: "123",
				title: "Book 1",
				authors: "Author 1",
				line_price: 10,
				quantity: 2,
				supplier_name: "Supplier 1",
				supplier_id: 1,
				total_book_number: 1,
				total_book_price: 10,
				supplier_order_id: 1,
				created: Date.now(),
				orderFormat: orderFormats.PBM,
				customerId: 2
			}
		];

		const result = processOrderDelivery(scannedBooks, placedOrderLines);

		const processedLine: ReconciliationProcessedLine = {
			authors: "Author 1",
			isbn: "123",
			supplier_id: 1,
			supplier_name: "Supplier 1",
			title: "Book 1",

			deliveredQuantity: 0,
			orderedQuantity: 2
		};
		expect(result).toEqual({
			processedLines: [expect.objectContaining(processedLine)],
			unmatchedBooks: []
		});
	});
});
