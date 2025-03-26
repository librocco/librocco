import { wrapIter } from "@librocco/shared";
import type { DB, DatabaseDump } from "./types";

export async function dumpData(db: DB): Promise<DatabaseDump> {
	const tableNames = wrapIter([
		"customer",
		"customer_order_lines",
		"book",
		"supplier",
		"supplier_publisher",
		"supplier_order",
		"supplier_order_line",
		"reconciliation_order",
		"reconciliation_order_lines",
		"customer_order_line_supplier_order",
		"warehouse",
		"note",
		"book_transaction",
		"custom_item"
	]);

	const tableDumps = await Promise.all(tableNames.map((table) => db.execO(`SELECT * FROM ${table}`)));

	return Object.fromEntries(tableNames.zip(tableDumps)) as DatabaseDump;
}
