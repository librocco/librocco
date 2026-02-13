import type { PageData } from "./$types";
import type { SupplierOrderSummary } from "./types";
import type { ReconciliationProcessedLine } from "$lib/components/supplier-orders/utils";

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

