import { wrapIter } from "@librocco/shared";
import type { DB, DatabaseDump } from "./types";

type SQLiteTableData = {
	name: string;
	rootpage: number;
	sql: string;
	tbl_name: string;
	type: "table";
};

async function getTables(db: DB, as?: "full"): Promise<SQLiteTableData[]>;
async function getTables(db: DB, as: "name_only"): Promise<string[]>;
async function getTables(db: DB, as: "name_only" | "full" = "full"): Promise<SQLiteTableData[] | string[]> {
	const cols = {
		full: "*",
		name_only: "name"
	}[as];

	const query = `
		SELECT ${cols} FROM sqlite_master WHERE type = 'table' AND name NOT LIKE '%crsql%'
	`;

	const res = await db.execO<SQLiteTableData>(query);

	if (as === "name_only") {
		return res.map(({ name }) => name);
	}

	return res;
}

async function getTableData(db: DB, tableName: string): Promise<any[]> {
	const query = `SELECT * FROM ${tableName}`;
	const data = await db.execO(query);
	return data;
}

async function getTablesData<T extends Record<string, Record<string, any>[]>>(db: DB, tableNames: string[]): Promise<T> {
	const tables = wrapIter(tableNames);
	const data = await Promise.all(tables.map((table) => getTableData(db, table)));
	return Object.fromEntries(tables.zip(data)) as T;
}

async function sqlFromJSON(data: DatabaseDump): Promise<string> {
	const tables = Object.entries(data);
	const sql = tables.map(([table, rows]) => {
		const keys = Object.keys(rows[0]);
		const placeholderLine = `(${multiplyString("?", keys.length)})`;

		return [
			`INSERT INTO ${table} (${keys.join(", ")}) VALUES`,
			Array(rows.length).fill(placeholderLine).join(",\n"),
			`ON CONFLICT DO UPDATE SET ${keys.map((key) => `${key} = excluded.${key}`).join(", ")}`
		].join("\n");
	});

	return sql.join("\n");
}

export async function dumpJSONData(db: DB): Promise<DatabaseDump> {
	const tableNames = await getTables(db, "name_only");
	return getTablesData(db, tableNames);
}

export async function dumpSQLData(db: DB): Promise<string> {
	const data = await dumpJSONData(db);
	return sqlFromJSON(data);
}

export async function loadJSONData(db: DB, data: DatabaseDump): Promise<void> {
	const sql = await sqlFromJSON(data);
	await db.exec(sql);
}

export const multiplyString = (str: string, n: number) => Array(n).fill(str).join(", ");
