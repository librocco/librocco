import { _groupIntoMap } from "@librocco/shared";

import type { PageData } from "./$types";
import type { SupplierOrderReconciliationSummary } from "./types";
import type { ReconciliationProcessedLine } from "$lib/components/supplier-orders/utils";
import type { DeliveryByISBN } from "$lib/db/cr-sqlite/types";

export function calcStatsBySupplierOrder(data?: PageData) {
	if (!data) {
		return [];
	}

	const { reconciliationOrderLines, placedOrderLines } = data;

	const scannedLineLookup = new Map(reconciliationOrderLines.map(({ isbn, quantity }) => [isbn, quantity]));

	// Map { supplier_order_id => SupplierOrderReconciliationSummary }
	const orders = new Map<number, SupplierOrderReconciliationSummary>();

	for (const line of placedOrderLines) {
		const { supplier_order_id, supplier_name, underdelivery_policy, isbn } = line;

		const remainingScanned = scannedLineLookup.get(isbn) || 0;

		const orderedQuantity = line.quantity;
		const deliveredQuantity = Math.min(remainingScanned, orderedQuantity);

		scannedLineLookup.set(isbn, remainingScanned - deliveredQuantity); // Safe with underdelivery (will deduct 0)

		// Create supplier order entry if not exists
		const order: SupplierOrderReconciliationSummary = orders.get(supplier_order_id) || {
			supplier_name,
			underdelivery_policy: underdelivery_policy ?? 0,
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

export function calcCustomerOrderDelivery(data: PageData): DeliveryByISBN[] {
	if (!data) {
		return [];
	}

	// Map { isbn => Iterable<CustomerDeliveryEntry> }
	const customerLineLookup = _groupIntoMap(data.customerOrderLines, ({ isbn, customer_name, customer_display_id, created }) => [
		isbn,
		{ customer_name, customer_display_id, created }
	]);

	return data.reconciliationOrderLines.map(({ isbn, title, quantity }) => ({
		isbn,
		title,
		total: quantity,
		customers: [...(customerLineLookup.get(isbn) || [])].slice(0, quantity)
	}));
}
