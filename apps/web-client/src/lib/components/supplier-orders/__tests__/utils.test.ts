import { describe, expect, it, vi, afterEach } from "vitest";

import { processOrderDelivery } from "../utils";

describe("processOrderDelivery should", () => {
	afterEach(() => {
		vi.clearAllMocks();
	});

	it("process when delivery matches order exactly", () => {
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

	it("increment both order lines when two supplier orders are being reconciled containing the same isbn", () => {
		const scannedBooks = [{ isbn: "123", title: "Book 1", authors: "Author 1", price: 10, quantity: 2 }];

		const placedOrderLines = [
			{
				isbn: "123",
				title: "Book 1",
				authors: "Author 1",
				line_price: 10,
				quantity: 1,
				supplier_name: "Supplier 1",
				id: 1,
				supplier_id: 1,
				total_book_number: 1,
				supplier_order_id: 1,
				total_book_price: 10,
				created: Date.now()
			},
			{
				isbn: "123",
				title: "Book 1",
				authors: "Author 1",
				line_price: 10,
				quantity: 1,
				supplier_name: "Supplier 2",
				id: 1,
				supplier_id: 1,
				total_book_number: 1,
				supplier_order_id: 2,
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
					quantity: 1,
					supplier_name: "Supplier 1",
					id: 1,
					supplier_id: 1,
					total_book_number: 1,
					supplier_order_id: 1,
					total_book_price: 10,
					deliveredQuantity: 1,
					orderedQuantity: 1,
					created: expect.any(Number)
				},
				{
					isbn: "123",
					title: "Book 1",
					authors: "Author 1",
					line_price: 10,
					quantity: 1,
					supplier_name: "Supplier 2",
					id: 1,
					supplier_id: 1,
					total_book_number: 1,
					supplier_order_id: 2,
					total_book_price: 10,
					deliveredQuantity: 1,
					orderedQuantity: 1,
					created: expect.any(Number)
				}
			],
			unmatchedBooks: []
		});
	});

	it("handle partial delivery", () => {
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

	it("handle over-delivery", () => {
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
					deliveredQuantity: 2,
					orderedQuantity: 2,
					created: expect.any(Number)
				}
			],
			unmatchedBooks: [{ isbn: "123", title: "Book 1", authors: "Author 1", price: 10, quantity: 1 }]
		});
	});

	it("handle unordered books", () => {
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

	it("handle under-delivery", () => {
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
});
