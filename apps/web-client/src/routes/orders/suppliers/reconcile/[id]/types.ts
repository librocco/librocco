// TODO: migrate to new definition (below) -- using the old one for compatibility rn
import type { ReconciliationProcessedLine } from "$lib/components/supplier-orders/utils";
//
// import type { BookData } from "@librocco/shared";
//
// export type ReconciliationProcessedLine = BookData & {
// 	supplier_id: number;
// 	supplier_name: string;

// 	ordered: number;
// 	delivered: number;
// };

export type SupplierOrderSummary = {
	supplier_order_id: number;
	supplier_name: string;
	lines: ReconciliationProcessedLine[];

	totalOrdered: number;
	totalDelivered: number;
	totalUnderdelivered: number;
};
