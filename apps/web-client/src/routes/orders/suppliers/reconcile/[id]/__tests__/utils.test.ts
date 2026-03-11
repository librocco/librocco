import { describe, expect, it } from "vitest";

import type { PageData } from "../$types";
import { calcAcceptedDeliveredTotal, calcCustomerOrderDelivery, calcOverdeliveryLines, calcOverdeliveredTotal } from "../utils";
import { OrderLineStatus } from "$lib/db/cr-sqlite/types";

function createData(): PageData {
	return {
		placedOrderLines: [
			{
				supplier_order_id: 1,
				supplier_name: "Supplier A",
				supplier_id: 1,
				underdelivery_policy: 0,
				isbn: "111",
				title: "Book 111",
				authors: "Author 111",
				publisher: "Pub",
				price: 10,
				quantity: 2,
				line_price: 10,
				created: 1,
				orderFormat: "PBM",
				customerId: 1
			},
			{
				supplier_order_id: 1,
				supplier_name: "Supplier A",
				supplier_id: 1,
				underdelivery_policy: 0,
				isbn: "222",
				title: "Book 222",
				authors: "Author 222",
				publisher: "Pub",
				price: 10,
				quantity: 1,
				line_price: 10,
				created: 1,
				orderFormat: "PBM",
				customerId: 1
			}
		],
		reconciliationOrderLines: [
			{
				reconciliation_order_id: 1,
				isbn: "111",
				quantity: 3,
				created: 1,
				authors: "Author 111",
				publisher: "Pub",
				price: 10,
				title: "Book 111"
			},
			{
				reconciliation_order_id: 1,
				isbn: "999",
				quantity: 2,
				created: 1,
				authors: "Author 999",
				publisher: "Pub",
				price: 10,
				title: "Book 999"
			}
		],
		customerOrderLines: [
			{
				id: 1,
				customer_id: 1,
				customer_name: "Alice",
				customer_display_id: "C-1",
				isbn: "111",
				title: "Book 111",
				authors: "Author 111",
				publisher: "Pub",
				price: 10,
				created: new Date(1),
				status: OrderLineStatus.Placed
			},
			{
				id: 2,
				customer_id: 2,
				customer_name: "Bob",
				customer_display_id: "C-2",
				isbn: "111",
				title: "Book 111",
				authors: "Author 111",
				publisher: "Pub",
				price: 10,
				created: new Date(2),
				status: OrderLineStatus.Placed
			},
			{
				id: 3,
				customer_id: 3,
				customer_name: "Carol",
				customer_display_id: "C-3",
				isbn: "999",
				title: "Book 999",
				authors: "Author 999",
				publisher: "Pub",
				price: 10,
				created: new Date(3),
				status: OrderLineStatus.Placed
			}
		]
	} as unknown as PageData;
}

describe("reconcile step utils", () => {
	it("calculates known and unknown overdelivery", () => {
		const data = createData();

		expect(calcAcceptedDeliveredTotal(data)).toBe(2);
		expect(calcOverdeliveredTotal(data)).toBe(3);
		expect(calcOverdeliveryLines(data)).toEqual([
			expect.objectContaining({ isbn: "111", overdeliveredQuantity: 1, orderedQuantity: 2, scannedQuantity: 3 }),
			expect.objectContaining({ isbn: "999", overdeliveredQuantity: 2, orderedQuantity: 0, scannedQuantity: 2 })
		]);
	});

	it("excludes overdelivered quantities from customer notification", () => {
		const data = createData();
		const delivery = calcCustomerOrderDelivery(data);

		expect(delivery).toHaveLength(1);
		expect(delivery[0].isbn).toBe("111");
		expect(delivery[0].total).toBe(2);
		expect(delivery[0].customers).toHaveLength(2);
	});
});
