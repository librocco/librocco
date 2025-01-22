import { vi, describe, it, expect, afterEach } from "vitest";

import { processOrderDelivery, sortLinesBySupplier, type ProcessedOrderLine } from "../utils";

afterEach(() => {
	vi.clearAllMocks();
});

describe("Misc helpers", () => {
	it("should process when delivery matches order exactly", () => {
		const scannedBooks = [
			{ isbn: "123", title: "Book 1", authors: "Author 1", price: 10, quantity: 1 },
			{ isbn: "123", title: "Book 1", authors: "Author 1", price: 10, quantity: 1 }
		];

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
		expect(result[0]).toEqual(
			expect.objectContaining({
				isbn: "123",
				delivered: true,
				wasOrdered: true,
				orderedQuantity: 2,
				deliveredQuantity: 2,
				remainingQuantity: 0
			})
		);
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
		expect(result[0]).toEqual(
			expect.objectContaining({
				isbn: "123",
				delivered: true,
				wasOrdered: true,
				orderedQuantity: 2,
				deliveredQuantity: 1,
				remainingQuantity: 1
			})
		);
	});

	it("should handle over-delivery", () => {
		const scannedBooks = [
			{ isbn: "123", title: "Book 1", authors: "Author 1", price: 10, quantity: 1 },
			{ isbn: "123", title: "Book 1", authors: "Author 1", price: 10, quantity: 1 },
			{ isbn: "123", title: "Book 1", authors: "Author 1", price: 10, quantity: 1 }
		];

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
		expect(result[0]).toEqual(
			expect.objectContaining({
				isbn: "123",
				delivered: true,
				wasOrdered: true,
				orderedQuantity: 2,
				deliveredQuantity: 3,
				remainingQuantity: 0
			})
		);
	});

	it("should handle unordered books", () => {
		const scannedBooks = [
			{ isbn: "456", title: "Book 2", authors: "Author 2", price: 15, quantity: 1 },
			{ isbn: "456", title: "Book 2", authors: "Author 2", price: 15, quantity: 1 }
		];

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
		expect(result).toHaveLength(2);
		expect(result[1]).toEqual(
			expect.objectContaining({
				isbn: "456",
				delivered: true,
				wasOrdered: false,
				orderedQuantity: 0,
				deliveredQuantity: 2,
				remainingQuantity: 0
			})
		);
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
