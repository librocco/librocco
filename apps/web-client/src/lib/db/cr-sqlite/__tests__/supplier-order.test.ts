import { describe, it, expect, beforeEach } from "vitest";

import { type DB } from "../types";

import { getRandomDb } from "./lib";

import {
	DEFAULT_SUPPLIER_NAME,
	upsertSupplier,
	associatePublisher,
	getPlacedSupplierOrders,
	getPossibleSupplierOrderLines,
	getPossibleSupplierOrders,
	createSupplierOrder,
	getPlacedSupplierOrderLines
} from "../suppliers";
import { addBooksToCustomer, getCustomerOrderLines, upsertCustomer } from "../customers";
import { upsertBook } from "../books";

const customer1 = { fullname: "John Doe", id: 1, displayId: "100" };
const customer2 = { fullname: "Harry Styles", id: 2, displayId: "200" };

const book1 = { isbn: "1", publisher: "MathsAndPhysicsPub", title: "Physics", authors: "Prince Edward", price: 7 };
const book2 = { isbn: "2", publisher: "ChemPub", title: "Chemistry", authors: "Dr. Small Hands", price: 13 };
const books = [book1, book2];

const supplier1 = { id: 1, name: "Alphabet Books LTD" };
const supplier2 = { id: 2, name: "Xanax Books LTD" };

let db: DB;

beforeEach(async () => {
	db = await getRandomDb();

	// Setup the entities that we're going to need each time, but don't associate them...
	// leave this to the tests for different scenarios
	await upsertCustomer(db, customer1);
	await upsertCustomer(db, customer2);
	await upsertBook(db, book1);
	await upsertBook(db, book2);
	await upsertSupplier(db, supplier1);
	await upsertSupplier(db, supplier2);
});

describe("New supplier orders:", () => {
	describe("getPossibleSupplierOrders should", () => {
		it("aggregate a supplier order from multiple client orders", async () => {
			const { id: supplierId, name: supplierName } = supplier1;

			// Associate book1 and book2 with the same supplier
			await associatePublisher(db, supplierId, book1.publisher);
			await associatePublisher(db, supplierId, book2.publisher);

			// Add book1 and book2 to different customer orders
			addBooksToCustomer(db, customer1.id, [book1.isbn]);
			addBooksToCustomer(db, customer2.id, [book2.isbn]);

			// There should be one possible supplier order...
			const result = await getPossibleSupplierOrders(db);
			expect(result.length).toBe(1);

			const [supplierOrder] = result;
			expect(supplierOrder.supplier_id).toBe(supplierId);
			expect(supplierOrder.supplier_name).toBe(supplierName);
			// It should include both books from the two customer orders
			expect(supplierOrder.total_book_number).toBe(books.length);
			expect(supplierOrder.total_book_price).toBe(books.reduce((acc, { price }) => acc + price, 0));
		});

		it("aggregate books that are not associated with a supplier into a 'General' order", async () => {
			// Do not associatePublisher

			// Add book1 and book2 to different customer orders
			addBooksToCustomer(db, customer1.id, [book1.isbn]);
			addBooksToCustomer(db, customer2.id, [book2.isbn]);

			// There should be one possible supplier order...
			const result = await getPossibleSupplierOrders(db);
			expect(result.length).toBe(1);

			const [supplierOrder] = result;
			expect(supplierOrder.supplier_id).toBe(null);
			expect(supplierOrder.supplier_name).toBe(DEFAULT_SUPPLIER_NAME);
		});

		it("group supplier orders and order them ascending by supplier name", async () => {
			// Associate book1 and book2 with the different suppliers
			await associatePublisher(db, supplier1.id, book1.publisher);
			await associatePublisher(db, supplier2.id, book2.publisher);

			// Add a book but don't associate it with a supplier
			const rogueBook = { isbn: "666", publisher: "Devil business", title: "The occult", price: 6 };
			await upsertBook(db, rogueBook);

			// Add books to a customer order
			addBooksToCustomer(db, customer1.id, [book1.isbn, book2.isbn, rogueBook.isbn]);

			// There should be two possible supplier order...
			const result = await getPossibleSupplierOrders(db);
			expect(result.length).toBe(3);

			const [supplierOrder1, generalOrder, supplierOrder2] = result;
			// They should be ordered:
			// Supplier1 name = "Alphabet ...",
			expect(supplierOrder1.supplier_name).toBe(supplier1.name);
			// The default "General" supplier
			expect(generalOrder.supplier_name).toBe(DEFAULT_SUPPLIER_NAME);
			// Suplier2 name = "Xanax ..."
			expect(supplierOrder2.supplier_name).toBe(supplier2.name);
		});

		it("should return an empty list when there are no customer order lines for that supplier", async () => {
			// Associate the books with suppliers...
			await associatePublisher(db, supplier1.id, book1.publisher);
			await associatePublisher(db, supplier2.id, book2.publisher);

			// But don't add any books to a customer order
			const result = await getPossibleSupplierOrders(db);
			expect(result).toEqual([]);
		});

		it("should only aggregate customer order lines that have not been placed", async () => {
			// Associate the books with a suppliers
			const { id: supplierId } = supplier1;
			await associatePublisher(db, supplierId, book1.publisher);
			await associatePublisher(db, supplierId, book2.publisher);

			// Add two books
			// book1 will not have any status timestamps
			addBooksToCustomer(db, customer1.id, [book1.isbn]);
			// book2 will have a placed timestamp
			await db.exec(
				`INSERT INTO customer_order_lines (customer_id, isbn, placed)
				VALUES ($customerId, $isbn, $placed)`,
				[customer1.id, book2.isbn, new Date().getTime()]
			);

			// Only book1 should be included
			const [newSupplierOrder] = await getPossibleSupplierOrders(db);
			expect(newSupplierOrder.total_book_number).toBe(1);
			expect(newSupplierOrder.total_book_price).toBe(book1.price);
		});

		it("should handle missing book prices", async () => {
			// Associate book1 with supplier1
			await associatePublisher(db, supplier1.id, book1.publisher);

			// Associate an isbn without book data to both suppliers
			const rogueBook = { isbn: "666", publisher: "Devil business" };
			await upsertBook(db, rogueBook);

			await associatePublisher(db, supplier1.id, rogueBook.publisher);
			await associatePublisher(db, supplier2.id, rogueBook.publisher);

			// Add all the books to the customer order
			addBooksToCustomer(db, customer1.id, [book1.isbn, rogueBook.isbn]);

			const [newSupplierOrder1, newSupplierOrder2] = await getPossibleSupplierOrders(db);
			// Supplier1 order should = book1.price + 0
			// TODO: is this desirable?
			expect(newSupplierOrder1.supplier_name).toBe(supplier1.name);
			expect(newSupplierOrder1.total_book_price).toBe(book1.price);

			// Supplier2 order should be 0
			expect(newSupplierOrder2.total_book_price).toBe(0);
		});
	});

	describe("getPossibleSupplierOrderLines should", () => {
		it("aggregate order lines from multiple customer orders for a supplier", async () => {
			const { id: supplierId, name: supplierName } = supplier1;

			// Associate both books with supplier1
			await associatePublisher(db, supplierId, book1.publisher);
			await associatePublisher(db, supplierId, book2.publisher);

			// Add books to different customer orders
			await addBooksToCustomer(db, customer1.id, [book1.isbn]);
			await addBooksToCustomer(db, customer2.id, [book2.isbn]);

			const result = await getPossibleSupplierOrderLines(db, supplierId);
			expect(result.length).toBe(2);

			// Should include both books from different customer orders
			expect(result).toEqual([
				{
					supplier_id: supplierId,
					supplier_name: supplierName,
					isbn: book1.isbn,
					authors: book1.authors,
					title: book1.title,
					quantity: 1,
					line_price: book1.price
				},
				{
					supplier_id: supplierId,
					supplier_name: supplierName,
					isbn: book2.isbn,
					authors: book2.authors,
					title: book2.title,
					quantity: 1,
					line_price: book2.price
				}
			]);
		});

		it("aggregate books without supplier association into a 'General' order", async () => {
			// Do not associate publishers with suppliers

			// Add books to customer orders
			await addBooksToCustomer(db, customer1.id, [book1.isbn]);
			await addBooksToCustomer(db, customer2.id, [book2.isbn]);

			const result = await getPossibleSupplierOrderLines(db, null);
			expect(result.length).toBe(2);

			// Both books should be in the general supplier order
			expect(result).toEqual([
				{
					supplier_id: null,
					supplier_name: DEFAULT_SUPPLIER_NAME,
					isbn: book1.isbn,
					authors: book1.authors,
					title: book1.title,
					quantity: 1,
					line_price: book1.price
				},
				{
					supplier_id: null,
					supplier_name: DEFAULT_SUPPLIER_NAME,
					isbn: book2.isbn,
					authors: book2.authors,
					title: book2.title,
					quantity: 1,
					line_price: book2.price
				}
			]);
		});

		it("aggregate quantities when same book is ordered multiple times", async () => {
			const { id: supplierId, name: supplierName } = supplier1;

			// Associate book1 with supplier1
			await associatePublisher(db, supplierId, book1.publisher);

			// Add same book twice to customer orders
			await addBooksToCustomer(db, customer1.id, [book1.isbn]);
			await addBooksToCustomer(db, customer2.id, [book1.isbn]);

			const result = await getPossibleSupplierOrderLines(db, supplierId);
			expect(result.length).toBe(1);

			// Should show aggregated quantity
			expect(result).toEqual([
				{
					supplier_id: supplierId,
					supplier_name: supplierName,
					isbn: book1.isbn,
					authors: book1.authors,
					title: book1.title,
					quantity: 2,
					line_price: book1.price * 2
				}
			]);
		});

		it("should only include unplaced customer order lines", async () => {
			const { id: supplierId } = supplier1;

			// Associate book1 with supplier1
			await associatePublisher(db, supplierId, book1.publisher);

			// Add one unplaced order
			await addBooksToCustomer(db, customer1.id, [book1.isbn]);

			// Add one placed order
			await db.exec(
				`INSERT INTO customer_order_lines (customer_id, isbn, placed)
				VALUES (?, ?, ?)`,
				[customer1.id, book1.isbn, new Date().getTime()]
			);

			const [orderLine] = await getPossibleSupplierOrderLines(db, supplierId);
			// There should only be one copy to be ordered
			expect(orderLine.quantity).toBe(1);
		});

		it("should handle missing book prices, title and authors", async () => {
			const { id: supplierId } = supplier1;

			// Create book without price
			const bookNoPrice = { isbn: "3", publisher: "MathsAndPhysicsPub" };
			await upsertBook(db, bookNoPrice);
			await associatePublisher(db, supplierId, bookNoPrice.publisher);

			// Add to customer order
			await addBooksToCustomer(db, customer1.id, [bookNoPrice.isbn]);

			const [orderLine] = await getPossibleSupplierOrderLines(db, supplierId);
			expect(orderLine.title).toBe("N/A");
			expect(orderLine.authors).toBe("N/A");
			expect(orderLine.line_price).toBe(0);
		});
	});
});

describe("Placing supplier orders", () => {
	describe("createSupplierOrder should", () => {
		it("create a supplier order from multiple customer orders", async () => {
			// Add books to different customer orders
			await addBooksToCustomer(db, customer1.id, [book1.isbn]);
			await addBooksToCustomer(db, customer2.id, [book2.isbn]);

			await createSupplierOrder(db, 1, [
				{ isbn: book1.isbn, quantity: 1, supplier_id: 1 },
				{ isbn: book2.isbn, quantity: 1, supplier_id: 1 }
			]);

			// Verify the order was created correctly
			const placedOrders = await getPlacedSupplierOrders(db);
			expect(placedOrders.length).toBe(1);
			expect(placedOrders[0]).toEqual(
				expect.objectContaining({
					supplier_id: 1,
					supplier_name: supplier1.name,
					total_book_number: 2,
					total_book_price: book1.price + book2.price
				})
			);

			// Verify the customer order lines were marked as placed
			const remainingPossibleLines = await getPossibleSupplierOrderLines(db, 1);
			expect(remainingPossibleLines.length).toBe(0);
		});

		// NOTE: This is really an extreme edge case - being resistant to bugs in possible line selection process (both getPossibleSupplierOrderLines and the UI selection)
		// The function also shows a warning re this
		it("not add more quantity than available in customer orders", async () => {
			// Add books to different customer orders
			await addBooksToCustomer(db, customer1.id, [book1.isbn]);
			await addBooksToCustomer(db, customer2.id, [book2.isbn]);

			await createSupplierOrder(db, 1, [
				{ isbn: book1.isbn, quantity: 1, supplier_id: 1 },
				{ isbn: book2.isbn, quantity: 2, supplier_id: 1 } // More quantity than available
			]);

			// Verify the order was created correctly
			const placedOrders = await getPlacedSupplierOrders(db);
			expect(placedOrders.length).toBe(1);
			expect(placedOrders[0]).toEqual(
				expect.objectContaining({
					supplier_id: 1,
					supplier_name: supplier1.name,
					total_book_number: 2,
					total_book_price: book1.price + book2.price
				})
			);
			expect(await getPlacedSupplierOrderLines(db, [placedOrders[0].id])).toEqual([
				expect.objectContaining({ isbn: book1.isbn, quantity: 1 }),
				expect.objectContaining({ isbn: book2.isbn, quantity: 1 }) // Corrected quantity
			]);

			// Verify the customer order lines were marked as placed
			const remainingPossibleLines = await getPossibleSupplierOrderLines(db, 1);
			expect(remainingPossibleLines.length).toBe(0);
		});

		it("not add more quantity than requested even if more available in customer orders", async () => {
			// Add books to different customer orders
			await addBooksToCustomer(db, customer1.id, [book1.isbn]);
			await addBooksToCustomer(db, customer2.id, [book1.isbn, book2.isbn]);

			await createSupplierOrder(db, 1, [
				{ isbn: book1.isbn, quantity: 1, supplier_id: 1 }, // 2 are required by customer orders, but only 1 ordered
				{ isbn: book2.isbn, quantity: 1, supplier_id: 1 }
			]);

			// Verify the order was created correctly
			const placedOrders = await getPlacedSupplierOrders(db);
			expect(placedOrders.length).toBe(1);
			expect(placedOrders[0]).toEqual(
				expect.objectContaining({
					supplier_id: 1,
					supplier_name: supplier1.name,
					total_book_number: 2,
					total_book_price: book1.price + book2.price
				})
			);
			expect(await getPlacedSupplierOrderLines(db, [placedOrders[0].id])).toEqual([
				expect.objectContaining({ isbn: book1.isbn, quantity: 1 }),
				expect.objectContaining({ isbn: book2.isbn, quantity: 1 })
			]);

			// Verify the customer order lines were marked as placed
			const remainingPossibleLines = await getPossibleSupplierOrderLines(db, 1);
			expect(remainingPossibleLines.length).toBe(0);
		});

		it("throw an error if trying to add order lines with supplier id different than the one passed as a param", async () => {
			// Add books to different customer orders
			await addBooksToCustomer(db, customer1.id, [book1.isbn]);
			await addBooksToCustomer(db, customer2.id, [book2.isbn]);

			const wantErrMsg = [
				"All order lines must belong to the same supplier:",
				"  supplier id: 1",
				"  faulty lines:",

				JSON.stringify({ isbn: book2.isbn, quantity: 1, supplier_id: 2 })
			].join("\n");

			expect(
				createSupplierOrder(db, 1, [
					{ isbn: book1.isbn, quantity: 1, supplier_id: 1 },
					{ isbn: book2.isbn, quantity: 1, supplier_id: 2 }
				])
			).rejects.toThrow(wantErrMsg);
		});

		// TODO: the following is skipped as I don't see a scenario where we would be creating multiple supplier orders with a single function call
		//
		// 		it("create multiple supplier orders from the same batch of customer orders", async () => {
		// 			// Associate each book with a different supplier
		// 			await associatePublisher(db, supplier1.id, book1.publisher);
		// 			await associatePublisher(db, supplier2.id, book2.publisher);
		//
		// 			// Add both books to a single customer order
		// 			await addBooksToCustomer(db, customer1.id, [book1.isbn, book2.isbn]);
		//
		// 			// Create orders for both suppliers
		// 			const supplier1Lines = await getPossibleSupplierOrderLines(db, supplier1.id);
		// 			const supplier2Lines = await getPossibleSupplierOrderLines(db, supplier2.id);
		// 			await createSupplierOrder(db, [...supplier1Lines, ...supplier2Lines]);
		//
		// 			// Verify two separate orders were created
		// 			const placedOrders = await getPlacedSupplierOrders(db);
		// 			expect(placedOrders.length).toBe(2);
		//
		// 			// Check specific order details
		// 			const [order1, order2] = placedOrders;
		// 			expect(order1.total_book_number).toBe(1);
		// 			expect(order2.total_book_number).toBe(1);
		//
		// 			// Verify all customer order lines were marked as placed
		// 			const remainingLines1 = await getPossibleSupplierOrderLines(db, supplier1.id);
		// 			const remainingLines2 = await getPossibleSupplierOrderLines(db, supplier2.id);
		// 			expect(remainingLines1.length).toBe(0);
		// 			expect(remainingLines2.length).toBe(0);
		// 		});

		it("handle creating an order with missing book prices", async () => {
			const { id: supplierId } = supplier1;

			// Create and associate a book without price
			const bookNoPrice = { isbn: "3", publisher: "MathsAndPhysicsPub" };
			await upsertBook(db, bookNoPrice);
			await associatePublisher(db, supplierId, bookNoPrice.publisher);

			// Add to customer order
			await addBooksToCustomer(db, customer1.id, [bookNoPrice.isbn]);

			// Create the order
			const possibleOrderLines = await getPossibleSupplierOrderLines(db, supplierId);
			await createSupplierOrder(db, supplierId, possibleOrderLines);

			// Verify order was created with zero price
			const [placedOrder] = await getPlacedSupplierOrders(db);
			expect(placedOrder.total_book_price).toBe(0);
			expect(placedOrder.total_book_number).toBe(1);
		});

		// NOTE: this is an edge case, and the UI probably shouldn't allow it.
		// Maybe this could also be handled by the UI allowing it, but showing an error message if attempted
		it("throw an error when trying to create a supplier order with no order lines", async () => {
			expect(createSupplierOrder(db, 1, [])).rejects.toThrow("No order lines provided");
		});

		it("timestamp supplier order's 'created' with ms precision", async () => {
			await addBooksToCustomer(db, customer1.id, [book1.isbn]);
			await createSupplierOrder(db, supplier1.id, [{ isbn: book1.isbn, quantity: 1, supplier_id: supplier1.id }]);
			const [{ created }] = await getPlacedSupplierOrders(db);
			expect(Date.now() - created).toBeLessThan(100);
		});

		it("timestamp customer order lines' 'placed' with ms precision", async () => {
			await addBooksToCustomer(db, customer1.id, [book1.isbn]);
			await createSupplierOrder(db, supplier1.id, [{ isbn: book1.isbn, quantity: 1, supplier_id: supplier1.id }]);
			const [customerOrderLine] = await getCustomerOrderLines(db, customer1.id);
			expect(Date.now() - customerOrderLine.placed.getTime()).toBeLessThan(100);
		});
	});

	describe("getPlacedSupplierOrders should", () => {
		it("retrieve orders from multiple suppliers with their details", async () => {
			const { id: supplier1Id } = supplier1;
			const { id: supplier2Id } = supplier2;

			// Create orders for both suppliers
			await db.exec(
				`
				INSERT INTO supplier_order (id, supplier_id, created)
				VALUES
				(?, ?, strftime('%s', 'now') * 1000),
				(?, ?, strftime('%s', 'now') * 1000)
			`,
				[1, supplier1Id, 2, supplier2Id]
			);

			// Add order lines with different quantities
			await db.exec(
				`
				INSERT INTO supplier_order_line (supplier_order_id, isbn, quantity)
				VALUES
				(1, ?, 2),  -- 2 copies of Physics
				(1, ?, 1),  -- 1 copy of Chemistry
				(2, ?, 3)   -- 3 copies of Physics
			`,
				[book1.isbn, book2.isbn, book1.isbn]
			);

			const orders = await getPlacedSupplierOrders(db);
			expect(orders).toHaveLength(2);

			// Check first supplier order
			expect(orders[0]).toEqual(
				expect.objectContaining({
					id: 1,
					supplier_id: supplier1Id,
					supplier_name: supplier1.name,
					total_book_number: 3,
					total_book_price: book1.price * 2 + book2.price,
					created: expect.any(Number)
				})
			);

			// Check second supplier order
			expect(orders[1]).toEqual(
				expect.objectContaining({
					id: 2,
					supplier_id: supplier2Id,
					supplier_name: supplier2.name,
					total_book_number: 3,
					total_book_price: book1.price * 3,
					created: expect.any(Number)
				})
			);
		});

		it("return orders sorted by creation date descending", async () => {
			const { id: supplierId } = supplier1;
			const now = Date.now();

			// Create orders with different timestamps
			await db.exec(
				`
				INSERT INTO supplier_order (id, supplier_id, created)
				VALUES
				(1, ?, ?),  -- older order
				(2, ?, ?)   -- newer order
			`,
				[supplierId, now - 1000, supplierId, now]
			);

			// Add same books to both orders
			await db.exec(
				`
				INSERT INTO supplier_order_line (supplier_order_id, isbn, quantity)
				VALUES
				(1, ?, 1),
				(2, ?, 1)
			`,
				[book1.isbn, book1.isbn]
			);

			const orders = await getPlacedSupplierOrders(db);
			expect(orders).toHaveLength(2);
			expect(orders[0].id).toBe(2); // Newer order first
			expect(orders[1].id).toBe(1); // Older order second
		});

		it("calculate correct totals when books have no prices", async () => {
			const { id: supplierId } = supplier1;

			// Create book without price
			const bookNoPrice = { isbn: "3", publisher: "MathsAndPhysicsPub" };
			await upsertBook(db, bookNoPrice);

			// Create order with mix of priced and non-priced books
			await db.exec(
				`
				INSERT INTO supplier_order (id, supplier_id, created)
				VALUES (1, ?, strftime('%s', 'now') * 1000)
			`,
				[supplierId]
			);

			await db.exec(
				`
				INSERT INTO supplier_order_line (supplier_order_id, isbn, quantity)
				VALUES
				(1, ?, 2),  -- 2 copies of book with price
				(1, ?, 1)   -- 1 copy of book without price
			`,
				[book1.isbn, bookNoPrice.isbn]
			);

			const [order] = await getPlacedSupplierOrders(db);
			expect(order.total_book_number).toBe(3);
			expect(order.total_book_price).toBe(book1.price * 2); // Only count books with prices
		});

		it("return empty array when no orders exist", async () => {
			const orders = await getPlacedSupplierOrders(db);
			expect(orders).toEqual([]);
		});

		it("handle orders with no order lines", async () => {
			const { id: supplierId } = supplier1;

			// TODO: should this be possible?
			// Create order without any lines
			await db.exec(
				`
				INSERT INTO supplier_order (id, supplier_id, created)
				VALUES (1, ?, strftime('%s', 'now') * 1000)
			`,
				[supplierId]
			);

			const [order] = await getPlacedSupplierOrders(db);
			expect(order).toEqual(
				expect.objectContaining({
					id: 1,
					supplier_id: supplierId,
					supplier_name: supplier1.name,
					total_book_number: 0,
					// * Sum + coalesce doesn't work in this scenario. I'm not sure this whole scenario should be possible so I'm not going to update it right now
					total_book_price: null
				})
			);
		});

		it("retrieve a list of placed supplier orders, filtered by supplier id", async () => {
			// Setup: add enough books to customer orders to avoid createSupplierOrder truncating
			// the quantity ordered, TODO: check for truncating functionality (might not be what we want)
			await upsertCustomer(db, { id: 3, displayId: "3" });
			await upsertCustomer(db, { id: 4, displayId: "4" });
			await upsertCustomer(db, { id: 5, displayId: "5" });
			await upsertCustomer(db, { id: 6, displayId: "6" });

			await addBooksToCustomer(db, 1, ["1", "2", "3"]);
			await addBooksToCustomer(db, 2, ["1", "2", "3"]);
			await addBooksToCustomer(db, 3, ["1", "2", "3"]);
			await addBooksToCustomer(db, 4, ["1", "2", "3"]);
			await addBooksToCustomer(db, 4, ["1", "2", "3"]);
			await addBooksToCustomer(db, 4, ["1", "2", "3"]);

			await createSupplierOrder(db, 1, [
				{ supplier_id: 1, isbn: "1", quantity: 2 },
				{ supplier_id: 1, isbn: "2", quantity: 1 }
			]);

			await createSupplierOrder(db, 2, [{ supplier_id: 2, isbn: "3", quantity: 3 }]);

			await createSupplierOrder(db, 1, [
				{ supplier_id: 1, isbn: "2", quantity: 3 },
				{ supplier_id: 1, isbn: "3", quantity: 3 }
			]);

			expect(await getPlacedSupplierOrders(db, 1)).toEqual([
				expect.objectContaining({
					id: 1,
					supplier_id: 1,
					supplier_name: supplier1.name,
					total_book_number: 3, // 2 Physics + 1 Chemistry
					created: expect.any(Number)
				}),
				expect.objectContaining({
					id: 3,
					supplier_id: 1,
					supplier_name: supplier1.name,
					total_book_number: 6, // 3 Physics + 3 The Hobbit
					created: expect.any(Number)
				})
			]);
		});
	});

	describe("getPlacedSupplierOrderLines should", () => {
		it("retrieve order lines from a single supplier order", async () => {
			const { id: supplierId, name: supplierName } = supplier1;

			const supplier_order_id = 1;
			// Create supplier order
			await db.exec(
				`INSERT INTO supplier_order (id, supplier_id, created)
				VALUES (?, ?, strftime('%s', 'now') * 1000)`,
				[supplier_order_id, supplierId]
			);

			// Add multiple books with different quantities
			await db.exec(
				`INSERT INTO supplier_order_line (supplier_order_id, isbn, quantity)
				VALUES
				(1, ?, 2),  -- 2 copies of book1
				(1, ?, 1)   -- 1 copy of book2`,
				[book1.isbn, book2.isbn]
			);

			const orderLines = await getPlacedSupplierOrderLines(db, [supplier_order_id]);
			expect(orderLines).toHaveLength(2);

			// Verify first line details
			expect(orderLines[0]).toEqual({
				supplier_order_id: 1,
				supplier_id: supplierId,
				supplier_name: supplierName,
				isbn: book1.isbn,
				title: book1.title,
				authors: book1.authors,
				quantity: 2,
				line_price: book1.price * 2,
				total_book_number: 3,
				total_book_price: book1.price * 2 + book2.price,
				created: expect.any(Number)
			});

			// Verify second line details
			expect(orderLines[1]).toEqual({
				supplier_order_id: 1,
				supplier_id: supplierId,
				supplier_name: supplierName,
				isbn: book2.isbn,
				title: book2.title,
				authors: book2.authors,
				quantity: 1,
				line_price: book2.price,
				total_book_number: 3,
				total_book_price: book1.price * 2 + book2.price,
				created: expect.any(Number)
			});
		});

		it("retrieve order lines from multiple supplier orders", async () => {
			// Create orders for both suppliers
			await db.exec(
				`INSERT INTO supplier_order (id, supplier_id, created)
				VALUES
				(1, ?, strftime('%s', 'now') * 1000),
				(2, ?, strftime('%s', 'now') * 1000)`,
				[supplier1.id, supplier2.id]
			);

			// Add books to both orders
			await db.exec(
				`INSERT INTO supplier_order_line (supplier_order_id, isbn, quantity)
				VALUES
				(1, ?, 2),  -- supplier1: 2 copies of book1
				(2, ?, 1)   -- supplier2: 1 copy of book2`,
				[book1.isbn, book2.isbn]
			);

			const orderLines = await getPlacedSupplierOrderLines(db, [1, 2]);
			expect(orderLines).toHaveLength(2);

			// Lines should be ordered by supplier_order_id, then isbn
			expect(orderLines[0].supplier_id).toBe(supplier1.id);
			expect(orderLines[0].isbn).toBe(book1.isbn);
			expect(orderLines[1].supplier_id).toBe(supplier2.id);
			expect(orderLines[1].isbn).toBe(book2.isbn);
		});

		it("handle books with missing prices", async () => {
			// Create book without price
			const bookNoPrice = { isbn: "3", publisher: "MathsAndPhysicsPub", title: "No Price Book", authors: "Anonymous" };
			await upsertBook(db, bookNoPrice);

			await associatePublisher(db, supplier1.id, book1.publisher);
			await associatePublisher(db, supplier1.id, bookNoPrice.publisher);

			// Create supplier order with both priced and unpriced books
			await db.exec(
				`INSERT INTO supplier_order (id, supplier_id, created)
				VALUES (1, ?, strftime('%s', 'now') * 1000)`,
				[supplier1.id]
			);

			await db.exec(
				`INSERT INTO supplier_order_line (supplier_order_id, isbn, quantity)
				VALUES
				(1, ?, 1),  -- book with price
				(1, ?, 2)   -- book without price`,
				[book1.isbn, bookNoPrice.isbn]
			);

			const orderLines = await getPlacedSupplierOrderLines(db, [1]);
			expect(orderLines).toHaveLength(2);

			// Total price should only include the priced book
			orderLines.forEach((line) => {
				expect(line.total_book_price).toBe(book1.price);
				expect(line.total_book_number).toBe(3);
			});
		});

		it("return empty array for non-existent order ids", async () => {
			const db = await getRandomDb();
			const orderLines = await getPlacedSupplierOrderLines(db, [999]);
			expect(orderLines).toEqual([]);
		});

		it("return empty array when no order ids provided", async () => {
			const db = await getRandomDb();
			const orderLines = await getPlacedSupplierOrderLines(db, []);
			expect(orderLines).toEqual([]);
		});

		it("handle orders with missing book metadata", async () => {
			const newBook = { isbn: "999", publisher: "MathsAndPhysicsPub" };
			await upsertBook(db, newBook);
			await associatePublisher(db, supplier1.id, newBook.publisher);

			const supplier_order_id = 1;

			// Create order for book that doesn't exist in books table
			await db.exec(
				`INSERT INTO supplier_order (id, supplier_id, created)
				VALUES (?, ?, strftime('%s', 'now') * 1000)`,
				[supplier_order_id, supplier1.id]
			);

			await db.exec(
				`INSERT INTO supplier_order_line (supplier_order_id, isbn, quantity)
				VALUES (?, ?, 1)`,
				[supplier_order_id, newBook.isbn]
			);

			const orderLines = await getPlacedSupplierOrderLines(db, [supplier_order_id]);
			expect(orderLines).toHaveLength(1);
			expect(orderLines[0]).toEqual(
				expect.objectContaining({
					isbn: newBook.isbn,
					title: "N/A",
					authors: "N/A",
					line_price: 0,
					quantity: 1
				})
			);
		});
	});
});
