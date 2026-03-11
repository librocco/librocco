import { _groupIntoMap } from "@librocco/shared";

import type { PageData } from "./$types";
import type { SupplierOrderReconciliationSummary } from "./types";
import type { ReconciliationProcessedLine } from "$lib/components/supplier-orders/utils";
import type { DeliveryByISBN } from "$lib/db/cr-sqlite/types";

export type ReconciliationOverdeliveryLine = {
	isbn: string;
	title: string;
	authors: string;
	orderedQuantity: number;
	scannedQuantity: number;
	overdeliveredQuantity: number;
};

export type ReconciliationBreakdown = {
	acceptedDeliveredByIsbn: Map<string, number>;
	overdeliveryLines: ReconciliationOverdeliveryLine[];
};

export function calcReconciliationBreakdown(data?: PageData): ReconciliationBreakdown {
	if (!data) {
		return {
			acceptedDeliveredByIsbn: new Map(),
			overdeliveryLines: []
		};
	}

	const orderedByIsbn = new Map<string, number>();
	for (const { isbn, quantity } of data.placedOrderLines) {
		orderedByIsbn.set(isbn, (orderedByIsbn.get(isbn) || 0) + quantity);
	}

	const scannedByIsbn = new Map<string, number>();
	const scannedMetaByIsbn = new Map<string, { title: string; authors: string }>();
	for (const { isbn, quantity, title, authors } of data.reconciliationOrderLines) {
		scannedByIsbn.set(isbn, (scannedByIsbn.get(isbn) || 0) + quantity);
		if (!scannedMetaByIsbn.has(isbn)) {
			scannedMetaByIsbn.set(isbn, { title, authors });
		}
	}

	const acceptedDeliveredByIsbn = new Map<string, number>();
	const overdeliveryLines: ReconciliationOverdeliveryLine[] = [];
	for (const [isbn, scannedQuantity] of scannedByIsbn.entries()) {
		const orderedQuantity = orderedByIsbn.get(isbn) || 0;
		const acceptedDelivered = Math.min(scannedQuantity, orderedQuantity);
		const overdeliveredQuantity = scannedQuantity - acceptedDelivered;

		acceptedDeliveredByIsbn.set(isbn, acceptedDelivered);

		if (overdeliveredQuantity > 0) {
			const meta = scannedMetaByIsbn.get(isbn) || { title: "N/A", authors: "N/A" };
			overdeliveryLines.push({
				isbn,
				title: meta.title,
				authors: meta.authors,
				orderedQuantity,
				scannedQuantity,
				overdeliveredQuantity
			});
		}
	}

	overdeliveryLines.sort((a, b) => a.isbn.localeCompare(b.isbn));

	return {
		acceptedDeliveredByIsbn,
		overdeliveryLines
	};
}

export function calcOverdeliveryLines(data?: PageData, breakdown?: ReconciliationBreakdown): ReconciliationOverdeliveryLine[] {
	return (breakdown || calcReconciliationBreakdown(data)).overdeliveryLines;
}

export function calcAcceptedDeliveredTotal(data?: PageData, breakdown?: ReconciliationBreakdown): number {
	return [...(breakdown || calcReconciliationBreakdown(data)).acceptedDeliveredByIsbn.values()].reduce(
		(sum, quantity) => sum + quantity,
		0
	);
}

export function calcOverdeliveredTotal(data?: PageData, breakdown?: ReconciliationBreakdown): number {
	return calcOverdeliveryLines(data, breakdown).reduce((sum, line) => sum + line.overdeliveredQuantity, 0);
}

export function calcStatsBySupplierOrder(data?: PageData, breakdown?: ReconciliationBreakdown) {
	if (!data) {
		return [];
	}

	const { acceptedDeliveredByIsbn } = breakdown || calcReconciliationBreakdown(data);
	const { placedOrderLines } = data;
	const scannedLineLookup = new Map(acceptedDeliveredByIsbn.entries());

	// Map { supplier_order_id => SupplierOrderReconciliationSummary }
	const orders = new Map<number, SupplierOrderReconciliationSummary>();

	// NOTE: we're sorting entries that will already be sorted, but this is here to ensure consistency even if upstream data source changes
	const sortedPlacedOrderLines = [...placedOrderLines].sort((a, b) => a.created - b.created);
	for (const line of sortedPlacedOrderLines) {
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

export function calcCustomerOrderDelivery(data: PageData, breakdown?: ReconciliationBreakdown): DeliveryByISBN[] {
	if (!data) {
		return [];
	}

	const { acceptedDeliveredByIsbn } = breakdown || calcReconciliationBreakdown(data);

	// Map { isbn => Iterable<CustomerDeliveryEntry> }
	const customerLineLookup = _groupIntoMap(data.customerOrderLines, ({ isbn, customer_name, customer_display_id, created }) => [
		isbn,
		{ customer_name, customer_display_id, created }
	]);

	const deliveriesByIsbn = new Map<string, DeliveryByISBN>();

	for (const { isbn, title } of data.reconciliationOrderLines) {
		if (deliveriesByIsbn.has(isbn)) {
			continue;
		}

		const acceptedDelivered = acceptedDeliveredByIsbn.get(isbn) || 0;
		if (acceptedDelivered <= 0) {
			continue;
		}

		// NOTE: we're sorting entries that will already be sorted, but this is here to ensure consistency even if upstream data source changes
		const customers = [...(customerLineLookup.get(isbn) || [])].sort((a, b) => Number(a.created) - Number(b.created));
		deliveriesByIsbn.set(isbn, {
			isbn,
			title,
			total: acceptedDelivered,
			customers: customers.slice(0, acceptedDelivered)
		});
	}

	return [...deliveriesByIsbn.values()];
}
