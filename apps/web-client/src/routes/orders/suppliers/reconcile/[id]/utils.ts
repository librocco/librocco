import { _groupIntoMap } from "@librocco/shared";

import type { PageData } from "./$types";
import type { SupplierOrderSummary } from "./types";
import type { ReconciliationProcessedLine } from "$lib/components/supplier-orders/utils";
import type { CustomerOrderLine } from "$lib/db/cr-sqlite/types";

export function calcStatsBySupplierOrder(data?: PageData) {
	if (!data) {
		return [];
	}

	const { reconciliationOrderLines, placedOrderLines } = data;

	const scannedLineLookup = new Map(reconciliationOrderLines.map(({ isbn, quantity }) => [isbn, quantity]));

	// Map { supplier_order_id => SupplierOrderSummary }
	const orders = new Map<number, SupplierOrderSummary>();

	for (const line of placedOrderLines) {
		const { supplier_order_id, supplier_name, isbn } = line;

		const remainingScanned = scannedLineLookup.get(isbn);

		const orderedQuantity = line.quantity;
		const deliveredQuantity = Math.min(remainingScanned, orderedQuantity);

		scannedLineLookup.set(isbn, remainingScanned - deliveredQuantity); // Safe with underdelivery (will deduct 0)

		// Create supplier order entry if not exists
		const order: SupplierOrderSummary = orders.get(supplier_order_id) || {
			supplier_name,
			supplier_order_id,
			lines: [],
			totalOrdered: 0,
			totalDelivered: 0,
			totalUnderdelivered: 0
		};
		const processedLine: ReconciliationProcessedLine = { ...line, orderedQuantity, deliveredQuantity };

		order.lines.push(processedLine);
		order.totalOrdered += orderedQuantity;
		order.totalDelivered += deliveredQuantity;
		order.totalUnderdelivered = order.totalOrdered - order.totalDelivered;

		orders.set(supplier_order_id, order);
	}

	return Array.from(orders.values());
}

type CustomerDeliveryEntry = Pick<CustomerOrderLine, "fullname" | "customer_display_id" | "created">;
type DeliveryByISBN = { isbn: string; title: string; total: number; customers: CustomerDeliveryEntry[] };
export function calcCustomerOrderDelivery(data: PageData): DeliveryByISBN[] {
	if (!data) {
		return [];
	}

	// Map { isbn => Iterable<CustomerDeliveryEntry> }
	const customerLineLookup = _groupIntoMap(data.customerOrderLines, ({ isbn, fullname, customer_display_id, created }) => [
		isbn,
		{ fullname, customer_display_id, created }
	]);

	return data.reconciliationOrderLines.map(({ isbn, title, quantity }) => ({
		isbn,
		title,
		total: quantity,
		customers: [...customerLineLookup.get(isbn)].slice(0, quantity)
	}));
}
