import type { Response } from "express";
import fs from "fs";
import path from "path";

interface Statement {
	reader: boolean;
	all: (...bind: unknown[]) => unknown[];
}

interface ReadonlyDatabase {
	prepare: (sql: string) => Statement;
	pragma: (sql: string) => unknown;
}

interface ReadonlyQueryLogger {
	info: (message: string) => void;
	error: (message: string) => void;
}

export class ReadonlyQueryClientError extends Error {
	code: unknown;

	constructor(message: string, options?: { code?: unknown; cause?: unknown }) {
		super(message, { cause: options?.cause });
		this.name = "ReadonlyQueryClientError";
		this.code = options?.code;
	}
}

export function getReadonlyDbPath(dbFolder: string, dbname: string): string {
	return path.resolve(dbFolder, dbname);
}

export function readonlyDatabaseExists(dbFolder: string, dbname: string): boolean {
	return fs.existsSync(getReadonlyDbPath(dbFolder, dbname));
}

export function runReadonlyQuery(db: ReadonlyDatabase, sql: string, bind: unknown[]): unknown[] {
	let stmt: Statement;
	try {
		stmt = db.prepare(sql);
	} catch (err) {
		throw toReadonlyQueryClientError(err);
	}

	if (!stmt.reader) {
		throw new ReadonlyQueryClientError("Only read statements are allowed");
	}

	db.pragma("query_only = ON");
	try {
		try {
			return stmt.all(...bind);
		} catch (err) {
			throw toReadonlyQueryClientError(err);
		}
	} finally {
		db.pragma("query_only = OFF");
	}
}

export function sendReadonlyQueryError(
	res: Response,
	err: unknown,
	context: { dbname: string; sql: string },
	logger: ReadonlyQueryLogger = console
) {
	if (err instanceof ReadonlyQueryClientError) {
		logger.info(
			`Read-only query rejected for "${context.dbname}": ${formatErrorForLog(err)} sql=${truncateSql(context.sql)}`
		);

		return res.status(400).json({
			message: err.message,
			...(err.code != null ? { code: err.code } : {})
		});
	}

	logger.error(`Read-only query failed for "${context.dbname}": ${formatErrorForLog(err)}`);
	return res.status(500).json({ message: "Read-only query failed" });
}

function toReadonlyQueryClientError(err: unknown): ReadonlyQueryClientError {
	return new ReadonlyQueryClientError(getErrorMessage(err), {
		code: getErrorCode(err),
		cause: err
	});
}

function getErrorMessage(err: unknown): string {
	return err instanceof Error ? err.message : String(err);
}

function getErrorCode(err: unknown): unknown {
	if (err == null || typeof err !== "object" || !("code" in err)) {
		return undefined;
	}

	return err.code;
}

function formatErrorForLog(err: unknown): string {
	if (!(err instanceof Error)) {
		return String(err);
	}

	const code = getErrorCode(err);
	const codePart = code != null ? ` code=${String(code)}` : "";
	return `${err.message}${codePart}\n${err.stack ?? ""}`;
}

function truncateSql(sql: string): string {
	const normalized = sql.replace(/\s+/g, " ").trim();
	return normalized.length > 200 ? `${normalized.slice(0, 200)}...` : normalized;
}
