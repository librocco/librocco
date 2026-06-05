import Database from "better-sqlite3";
import fs from "fs";
import path from "path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
	ReadonlyQueryClientError,
	readonlyDatabaseExists,
	runReadonlyQuery,
	sendReadonlyQueryError
} from "./readonly-query.js";

const TEST_DIR = "/tmp/readonly-query-test-vitest";

function cleanup() {
	if (fs.existsSync(TEST_DIR)) {
		fs.rmSync(TEST_DIR, { recursive: true });
	}
	fs.mkdirSync(TEST_DIR, { recursive: true });
}

function createResponse() {
	const response = {
		statusCode: 200,
		body: undefined as unknown,
		status(code: number) {
			this.statusCode = code;
			return this;
		},
		json(body: unknown) {
			this.body = body;
			return this;
		}
	};

	return response;
}

describe("readonly query helpers", () => {
	beforeEach(() => {
		cleanup();
	});

	afterEach(() => {
		cleanup();
	});

	it("checks that the database file exists before cache access", () => {
		expect(readonlyDatabaseExists(TEST_DIR, "missing.sqlite3")).toBe(false);

		fs.writeFileSync(path.join(TEST_DIR, "current.sqlite3"), "");

		expect(readonlyDatabaseExists(TEST_DIR, "current.sqlite3")).toBe(true);
	});

	it("runs read statements", () => {
		const db = new Database(":memory:");
		db.exec("CREATE TABLE book (id INTEGER PRIMARY KEY, title TEXT); INSERT INTO book (title) VALUES ('A');");

		const rows = runReadonlyQuery(db, "SELECT title FROM book", []);

		expect(rows).toEqual([{ title: "A" }]);
		db.close();
	});

	it("rejects non-reader statements as client errors", () => {
		const db = new Database(":memory:");
		db.exec("CREATE TABLE book (id INTEGER PRIMARY KEY, title TEXT);");

		expect(() => runReadonlyQuery(db, "INSERT INTO book (title) VALUES ('B')", [])).toThrow(ReadonlyQueryClientError);

		db.close();
	});

	it("blocks reader statements that attempt writes", () => {
		const db = new Database(":memory:");
		db.exec("CREATE TABLE book (id INTEGER PRIMARY KEY, title TEXT); INSERT INTO book (title) VALUES ('A');");

		expect(() => runReadonlyQuery(db, "UPDATE book SET title = 'B' RETURNING title", [])).toThrow(
			ReadonlyQueryClientError
		);
		expect(db.prepare("SELECT title FROM book").pluck().get()).toBe("A");

		db.close();
	});

	it("returns client errors as 400 with the underlying message", () => {
		const res = createResponse();
		const logger = { info: vi.fn(), error: vi.fn() };

		sendReadonlyQueryError(
			res as never,
			new ReadonlyQueryClientError("near \"SELCT\": syntax error", { code: "SQLITE_ERROR" }),
			{ dbname: "current.sqlite3", sql: "SELCT * FROM book" },
			logger
		);

		expect(res.statusCode).toBe(400);
		expect(res.body).toEqual({ message: 'near "SELCT": syntax error', code: "SQLITE_ERROR" });
		expect(logger.info).toHaveBeenCalledOnce();
		expect(logger.error).not.toHaveBeenCalled();
	});

	it("returns server errors as 500 with a generic client body and server log", () => {
		const res = createResponse();
		const logger = { info: vi.fn(), error: vi.fn() };

		sendReadonlyQueryError(
			res as never,
			new Error("schema version mismatch"),
			{ dbname: "current.sqlite3", sql: "SELECT * FROM book" },
			logger
		);

		expect(res.statusCode).toBe(500);
		expect(res.body).toEqual({ message: "Read-only query failed" });
		expect(logger.error).toHaveBeenCalledOnce();
		expect(logger.info).not.toHaveBeenCalled();
	});
});
