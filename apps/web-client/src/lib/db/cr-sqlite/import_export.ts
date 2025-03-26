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

export async function loadData(db: DB, data: DatabaseDump): Promise<void> {
	for (const [table, rows] of Object.entries(data)) {
		// Skip if empty
		if (!rows.length) continue;

		// Get column values
		const keys = Object.keys(rows[0]);

		const placeholderLine = `(${multiplyString("?", keys.length)})`;

		const stmt = [
			`INSERT INTO ${table} (${keys.join(", ")}) VALUES`,
			Array(rows.length).fill(placeholderLine).join(",\n"),
			`ON CONFLICT SET ${keys.map((key) => `${key} = EXCLUDED.${key}`).join(", ")}`
		].join("\n");

		await db.exec(
			stmt,
			rows.flatMap((row: any) => Object.values(row) as any[])
		);
	}
}

export const multiplyString = (str: string, n: number) => Array(n).fill(str).join(", ");
