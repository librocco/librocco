/* eslint-disable no-case-declarations */
import { beforeEach, describe, expect, test } from "vitest";

import { CustomerOrderState, OrderItemStatus, testUtils } from "@librocco/shared";

import { OrderItem, VersionString } from "@/types";

import * as implementations from "@/implementations/orders";

import { createVersioningFunction } from "@/utils/misc";
import { newTestDB } from "@/__testUtils__/db";

const { waitFor } = testUtils;

/**
 * We're using EMPTY as a symbol, rather than 'undefined' or 'null' to be able to differentiate,
 * with absolute certainty, between the stream not emitting anything and the stream emitting something.
 */
const EMPTY = Symbol("empty");
type PossiblyEmpty<T> = typeof EMPTY | T;

// Using 'describe.each' allows us to run tests against each version of the db interface implementation.
const schema = Object.entries(implementations).map(([version, getDB]) => ({ version, getDB }));
describe.each(schema)("Orders unit tests: $version", ({ version, getDB }) => {
	let db = newTestDB(getDB);
	const versionId = createVersioningFunction(version as VersionString);

	// Initialise a new db for each test
	beforeEach(async () => {
		db = newTestDB(getDB);
		await db.init();
	});

	// Base functionality
	test("standardApi", async () => {
		// If a customer order doesn't exist, a new one should be initialised with default values
		// but no data should be saved to the db until explicitly done so.
		let order1 = db.customerOrder("order1");
		expect(order1._id).toEqual(versionId("order1"));

		// Order doesn't yet exist in the db.
		const orderInDB = await order1.get();
		expect(orderInDB).toBeUndefined();

		// Save the order to db and access from different instance.
		order1 = await order1.create();
		const order1newInstance = await db.customerOrder("order1").get();
		expect(order1newInstance).toEqual(order1);

		// Order creation is idempotent
		const order1newInstance2 = await db.customerOrder("order1").create();
		expect(order1newInstance2).toEqual(order1);
	});

	test("customerOrderBookOperations", async () => {
		// Create a new customer order
		const order = await db.customerOrder().create();

		// Subscribe to entries to receive updates
		let entries: PossiblyEmpty<OrderItem[]> = EMPTY;
		let orderState: PossiblyEmpty<string> = EMPTY;
		order
			.stream()
			.books({})
			.subscribe((books) => (entries = books));
		order
			.stream()
			.state({})
			.subscribe((state) => (orderState = state));

		// Initial stream should be empty
		await waitFor(() => {
			expect(entries).toEqual([]);
		});

		// Test adding books
		await order.addBooks({}, "11111111", "0123456789", "11111111");
		await waitFor(() => {
			expect(entries).toEqual([
				{ isbn: "0123456789", status: OrderItemStatus.Draft },
				{ isbn: "11111111", status: OrderItemStatus.Draft },
				{ isbn: "11111111", status: OrderItemStatus.Draft }
			]);
		});

		// Removing books should remove transactions from the order
		await order.removeBooks({}, "0123456789");
		await waitFor(() => {
			expect(entries).toEqual([
				{ isbn: "11111111", status: OrderItemStatus.Draft },
				{ isbn: "11111111", status: OrderItemStatus.Draft }
			]);
		});

		// Running remove books should be a no-op if books don't exist
		await order.removeBooks({}, "12345678", "1234567890");
		await waitFor(() => {
			expect(entries).toEqual([
				{ isbn: "11111111", status: OrderItemStatus.Draft },
				{ isbn: "11111111", status: OrderItemStatus.Draft }
			]);
		});

		// Add some more books to test updating of book status
		await order.addBooks({}, "1234567890", "12345678", "1234567890", "1234567890");
		await waitFor(() => {
			expect(entries).toEqual([
				{ isbn: "11111111", status: OrderItemStatus.Draft },
				{ isbn: "11111111", status: OrderItemStatus.Draft },
				{ isbn: "12345678", status: OrderItemStatus.Draft },
				{ isbn: "1234567890", status: OrderItemStatus.Draft },
				{ isbn: "1234567890", status: OrderItemStatus.Draft },
				{ isbn: "1234567890", status: OrderItemStatus.Draft }
			]);
		});

		// Commit the order
		await order.setEmail({}, "email@test.com");
		await order.commit({});
		await waitFor(() => expect(orderState).toEqual(CustomerOrderState.Committed));
		await waitFor(() => {
			expect(entries).toEqual([
				{ isbn: "11111111", status: OrderItemStatus.Placed },
				{ isbn: "11111111", status: OrderItemStatus.Placed },
				{ isbn: "12345678", status: OrderItemStatus.Placed },
				{ isbn: "1234567890", status: OrderItemStatus.Placed },
				{ isbn: "1234567890", status: OrderItemStatus.Placed },
				{ isbn: "1234567890", status: OrderItemStatus.Placed }
			]);
		});

		// No books can be added/removed after the order had been committed
		await order.addBooks({}, "1234567890");
		await order.removeBooks({}, "1234567890");
		await waitFor(() => {
			expect(entries).toEqual([
				{ isbn: "11111111", status: OrderItemStatus.Placed },
				{ isbn: "11111111", status: OrderItemStatus.Placed },
				{ isbn: "12345678", status: OrderItemStatus.Placed },
				{ isbn: "1234567890", status: OrderItemStatus.Placed },
				{ isbn: "1234567890", status: OrderItemStatus.Placed },
				{ isbn: "1234567890", status: OrderItemStatus.Placed }
			]);
		});

		// Book status updates should be possible after the order had been committed
		let statusRes = await order.updateBookStatus({}, ["11111111", "1234567890", "1234567890"], OrderItemStatus.Delivered);
		// The updates should be done in one-update / one-book manner
		await waitFor(() => {
			expect(entries).toEqual([
				{ isbn: "11111111", status: OrderItemStatus.Delivered },
				{ isbn: "11111111", status: OrderItemStatus.Placed },
				{ isbn: "12345678", status: OrderItemStatus.Placed },
				{ isbn: "1234567890", status: OrderItemStatus.Delivered },
				{ isbn: "1234567890", status: OrderItemStatus.Delivered },
				{ isbn: "1234567890", status: OrderItemStatus.Placed }
			]);
		});
		// Status res should be empty (all updates were successful)
		expect(statusRes).toEqual([]);

		// Status update should return a list of isbns that were not updated (books don't exist or are already in the requested state)
		statusRes = await order.updateBookStatus(
			{},
			["12345678", "1234567891", "1234567890", "1234567890", "1234567890"],
			OrderItemStatus.Delivered
		);
		await waitFor(() => {
			expect(entries).toEqual([
				{ isbn: "11111111", status: OrderItemStatus.Delivered },
				{ isbn: "11111111", status: OrderItemStatus.Placed },
				{ isbn: "12345678", status: OrderItemStatus.Delivered },
				{ isbn: "1234567890", status: OrderItemStatus.Delivered },
				{ isbn: "1234567890", status: OrderItemStatus.Delivered },
				{ isbn: "1234567890", status: OrderItemStatus.Delivered }
			]);
		});

		// Non-applied updates hould be returned
		expect(statusRes).toEqual(["1234567891", "1234567890", "1234567890"]);
	});

	test("sequential naming", async () => {
		// Customer orders
		const customerOrder1 = await db.customerOrder().create();
		expect(customerOrder1.displayName).toEqual("Order-1");
		const customerOrder2 = await db.customerOrder().create();
		expect(customerOrder2.displayName).toEqual("Order-2");
	});
});
