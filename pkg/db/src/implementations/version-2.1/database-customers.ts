import { debug } from "@librocco/shared";
import { SQLocal } from "sqlocal";

type ReactiveTriggerFunction = (table: string) => Promise<void>;

export const createCustomerTables = async (
	createReactiveTrigger: ReactiveTriggerFunction,
	sql: SQLocal["sql"],
	ctx: debug.DebugCtx = {}
) => {
	await sql(`CREATE TABLE IF NOT EXISTS customer (
		id INTEGER,
		fullname TEXT,
		email TEXT,
		deposit DECIMAL,
		PRIMARY KEY (id)
	)`);
	createReactiveTrigger("customer");

	await sql(`CREATE TABLE IF NOT EXISTS customer_order_lines (
		id INTEGER,
		customer_id TEXT,
		isbn TEXT,
		quantity INTEGER,
		PRIMARY KEY (id),
		FOREIGN KEY (customer_id) REFERENCES customer(id)
	)`);
	createReactiveTrigger("customer_order_lines");

	debug.log(ctx, "Customer tables created")("");
};
