import { wrapIter } from "@librocco/shared";
import type { DB } from "./types";

type SQLiteTableData = {
	name: string;
	rootpage: number;
	sql: string;
	tbl_name: string;
	type: "table";
};

type TableJSONData = {
	tbl_name: string;
	sql: string;
	rows: Record<string, any>[];
};

async function getTables(db: DB, which: "user_only" | "full" = "full"): Promise<SQLiteTableData[]> {
	const filter = {
		full: "",
		user_only: "name NOT LIKE '%crsql%'"
	}[which];

	const query = `
		SELECT * FROM sqlite_master
		WHERE type = 'table' ${filter ? `AND ${filter}` : ""}
	`;

	const res = await db.execO<SQLiteTableData>(query);

	return res;
}

async function getTableRows(db: DB, tableName: string): Promise<any[]> {
	const query = `SELECT * FROM ${tableName}`;
	const data = await db.execO(query);
	return data;
}

async function sqlFromJSON(dump: TableJSONData[], mode: "full" | "schema_only" | "data_only"): Promise<string> {
	const schema = dump
		.map(({ sql }) => sql)
		.filter(Boolean)
		.join("\n");

	const data = dump
		.filter(({ rows }) => rows?.length)
		.map(({ tbl_name, rows }) => {
			const keys = Object.keys(rows[0]);

			const rowValuesToInsertLine = (row: Record<string, any>) => {
				const values = Object.values(row).map((value) => (value === null ? "NULL" : `'${value}'`));
				return `(${values.join(", ")})`;
			};

			return (
				[
					`INSERT INTO ${tbl_name} (${keys.join(", ")}) VALUES`,
					rows.map(rowValuesToInsertLine).join(",\n"),
					`ON CONFLICT DO UPDATE SET ${keys.map((key) => `${key} = excluded.${key}`).join(", ")}`
				].join("\n") + ";"
			);
		})
		.join("\n\n");

	switch (mode) {
		case "full":
			return [schema, data].join("\n");
		case "schema_only":
			return schema;
		case "data_only":
			return data;
	}
}

export async function dumpJSONData(db: DB, which: "user_only" | "full"): Promise<TableJSONData[]> {
	const tables = await getTables(db, which).then(wrapIter);
	const allRows = await Promise.all(tables.map(({ tbl_name }) => getTableRows(db, tbl_name)));
	const merged = tables.zip(allRows).map(([{ tbl_name, sql }, rows]) => ({ tbl_name, sql, rows }));
	return Array.from(merged);
}

export async function dumpSQLData(db: DB, which: "user_only" | "full", mode: "full" | "schema_only" | "data_only"): Promise<string> {
	const data = await dumpJSONData(db, which);
	return sqlFromJSON(data, mode);
}

export async function loadJSONData(db: DB, data: TableJSONData[], mode: "full" | "schema_only" | "data_only"): Promise<void> {
	const sql = await sqlFromJSON(data, mode);
	await db.exec(sql);
}

export const multiplyString = (str: string, n: number) => Array(n).fill(str).join(", ");
