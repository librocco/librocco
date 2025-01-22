import { vi, describe, it, expect, afterEach } from "vitest";

import { processOrderDelivery, sortLinesBySupplier, type ProcessedOrderLine } from "../utils";

afterEach(() => {
	vi.clearAllMocks();
});

describe("Misc helpers", () => {
	it("should process when delivery matches order exactly", () => {
		const scannedBooks = [{ isbn: "123", title: "Book 1", authors: "Author 1", price: 10, quantity: 2 }];

		const placedOrderLines = [
			{
				isbn: "123",
				title: "Book 1",
				authors: "Author 1",
				price: 10,
				quantity: 2,
				supplier_name: "Supplier 1",
				id: 1,
				supplier_id: 1,
				total_book_number: 1,
				supplier_order_id: 1,
				total_price: 10,
				created: Date.now()
			}
		];

		const result = processOrderDelivery(scannedBooks, placedOrderLines);
		expect(result).toEqual({
			processedLines: [
				{
					isbn: "123",
					authors: "Author 1",
					deliveredQuantity: 2,
					orderedQuantity: 2,
					price: 10,
					quantity: 2,
					title: "Book 1"
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
				price: 10,
				quantity: 2,
				supplier_name: "Supplier 1",
				id: 1,
				supplier_id: 1,
				total_book_number: 1,
				supplier_order_id: 1,
				total_price: 10,
				created: Date.now()
			}
		];

		const result = processOrderDelivery(scannedBooks, placedOrderLines);
		expect(result).toEqual({
			processedLines: [
				{
					isbn: "123",
					authors: "Author 1",
					deliveredQuantity: 1,
					orderedQuantity: 2,
					price: 10,
					quantity: 1,
					title: "Book 1"
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
				price: 10,
				quantity: 2,
				supplier_name: "Supplier 1",
				id: 1,
				supplier_id: 1,
				total_book_number: 1,
				supplier_order_id: 1,
				total_price: 10,
				created: Date.now()
			}
		];

		const result = processOrderDelivery(scannedBooks, placedOrderLines);
		expect(result).toEqual({
			processedLines: [
				{
					isbn: "123",
					authors: "Author 1",
					deliveredQuantity: 3,
					orderedQuantity: 2,
					price: 10,
					quantity: 3,
					title: "Book 1"
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
				price: 10,
				quantity: 2,
				supplier_name: "Supplier 1",
				id: 1,
				supplier_id: 1,
				total_book_number: 1,
				supplier_order_id: 1,
				total_price: 10,
				created: Date.now()
			}
		];

		const result = processOrderDelivery(scannedBooks, placedOrderLines);
		expect(result).toEqual({
			processedLines: [],
			unmatchedBooks: [
				expect.objectContaining({
					authors: "Author 1",
					id: 1,
					isbn: "123",
					price: 10,
					quantity: 2,
					supplier_id: 1,
					supplier_name: "Supplier 1",
					supplier_order_id: 1,
					title: "Book 1",
					total_book_number: 1,
					total_price: 10
				}),
				expect.objectContaining({
					authors: "Author 2",
					isbn: "456",
					price: 15,
					quantity: 2,
					title: "Book 2"
				})
			]
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
