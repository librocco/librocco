/**
 * Tests for database health check module.
 *
 * These tests verify that the sync server properly detects and reports
 * database corruption and configuration issues at startup.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { checkDatabaseHealth, formatHealthCheckResults, checkAllDatabases } from "./db-health.js";
import { extensionPath } from "@vlcn.io/crsqlite";
import Database from "better-sqlite3";
import fs from "fs";
import path from "path";

const TEST_DIR = "/tmp/db-health-test-vitest";

function cleanup() {
	if (fs.existsSync(TEST_DIR)) {
		fs.rmSync(TEST_DIR, { recursive: true });
	}
	fs.mkdirSync(TEST_DIR, { recursive: true });
}

function createHealthyDb(name: string): string {
	const dbPath = path.join(TEST_DIR, name);
	const db = new Database(dbPath);
	db.loadExtension(extensionPath);

	// Create a proper CRDT-enabled table with schema tracking
	db.exec(`
		CREATE TABLE IF NOT EXISTS test (id INTEGER PRIMARY KEY NOT NULL, name TEXT);
		SELECT crsql_as_crr('test');
		INSERT INTO test (id, name) VALUES (1, 'test');
	`);

	// Set schema info in crsql_master (mimicking what the sync server does)
	db.exec(`
		INSERT OR REPLACE INTO crsql_master (key, value) VALUES ('schema_name', 'test_schema');
		INSERT OR REPLACE INTO crsql_master (key, value) VALUES ('schema_version', '12345');
	`);

	db.close();
	return dbPath;
}

function createDbWithoutSchema(name: string): string {
	const dbPath = path.join(TEST_DIR, name);
	const db = new Database(dbPath);
	// Create a plain SQLite database without crsqlite extension
	db.exec(`CREATE TABLE test (id INTEGER PRIMARY KEY NOT NULL);`);
	db.close();
	return dbPath;
}

function createCorruptDb(name: string): string {
	const dbPath = path.join(TEST_DIR, name);
	// Write garbage to simulate corruption
	fs.writeFileSync(dbPath, "This is not a valid SQLite database file");
	return dbPath;
}

describe("Database Health Check", () => {
	beforeEach(() => {
		cleanup();
	});

	afterEach(() => {
		cleanup();
	});

	describe("checkDatabaseHealth", () => {
		it("should return ok for non-existent database", () => {
			const result = checkDatabaseHealth("/tmp/nonexistent-db.sqlite3", extensionPath);
			expect(result.ok).toBe(true);
			expect(result.checks).toHaveLength(1);
			expect(result.checks[0].name).toBe("file_exists");
			expect(result.checks[0].passed).toBe(true);
		});

		it("should pass all checks for a healthy database", () => {
			const dbPath = createHealthyDb("healthy.sqlite3");
			const result = checkDatabaseHealth(dbPath, extensionPath);

			expect(result.ok).toBe(true);
			expect(result.checks.some((c) => c.name === "sqlite_integrity" && c.passed)).toBe(true);
			expect(result.checks.some((c) => c.name === "crsqlite_extension" && c.passed)).toBe(true);
			expect(result.checks.some((c) => c.name === "crsql_changes_accessible" && c.passed)).toBe(true);
			expect(result.checks.some((c) => c.name === "crsql_master_valid" && c.passed)).toBe(true);
			expect(result.checks.some((c) => c.name === "site_id_valid" && c.passed)).toBe(true);
			expect(result.checks.some((c) => c.name === "clock_tables_exist" && c.passed)).toBe(true);
		});

		it("should fail for database without crsqlite schema info", () => {
			const dbPath = createDbWithoutSchema("no-schema.sqlite3");
			const result = checkDatabaseHealth(dbPath, extensionPath);

			// Should still be able to load extension and access crsql_changes (it's a virtual table)
			expect(result.checks.some((c) => c.name === "crsqlite_extension" && c.passed)).toBe(true);

			// But should fail on crsql_master validation (no schema_name/schema_version)
			expect(result.checks.some((c) => c.name === "crsql_master_valid" && !c.passed)).toBe(true);

			// Overall should fail
			expect(result.ok).toBe(false);
		});

		it("should fail for corrupted database file", () => {
			const dbPath = createCorruptDb("corrupt.sqlite3");
			const result = checkDatabaseHealth(dbPath, extensionPath);

			expect(result.ok).toBe(false);
			// Should fail to open the database
			expect(result.checks.some((c) => c.name === "database_open" && !c.passed)).toBe(true);
		});

		it("should report no clock tables as a warning", () => {
			const dbPath = createDbWithoutSchema("no-clock.sqlite3");
			const result = checkDatabaseHealth(dbPath, extensionPath);

			const clockCheck = result.checks.find((c) => c.name === "clock_tables_exist");
			expect(clockCheck).toBeDefined();
			expect(clockCheck?.passed).toBe(false);
			expect(clockCheck?.severity).toBe("warning");
		});
	});

	describe("checkAllDatabases", () => {
		it("should return empty map for non-existent folder", () => {
			const results = checkAllDatabases("/tmp/nonexistent-folder", extensionPath);
			expect(results.size).toBe(0);
		});

		it("should check all databases in a folder", () => {
			createHealthyDb("db1.sqlite3");
			createDbWithoutSchema("db2.sqlite3");

			const results = checkAllDatabases(TEST_DIR, extensionPath);
			expect(results.size).toBe(2);
			expect(results.has("db1.sqlite3")).toBe(true);
			expect(results.has("db2.sqlite3")).toBe(true);
		});

		it("should ignore non-sqlite files", () => {
			createHealthyDb("db1.sqlite3");
			fs.writeFileSync(path.join(TEST_DIR, "readme.txt"), "This is not a database");

			const results = checkAllDatabases(TEST_DIR, extensionPath);
			expect(results.size).toBe(1);
			expect(results.has("db1.sqlite3")).toBe(true);
			expect(results.has("readme.txt")).toBe(false);
		});
	});

	describe("formatHealthCheckResults", () => {
		it("should format results with colors", () => {
			const dbPath = createHealthyDb("test.sqlite3");
			const result = checkDatabaseHealth(dbPath, extensionPath);

			const results = new Map();
			results.set("test.sqlite3", result);

			const formatted = formatHealthCheckResults(results);
			expect(formatted).toContain("DATABASE HEALTH CHECK");
			expect(formatted).toContain("test.sqlite3");
		});

		it("should show failure message for unhealthy databases", () => {
			const dbPath = createCorruptDb("corrupt.sqlite3");
			const result = checkDatabaseHealth(dbPath, extensionPath);

			const results = new Map();
			results.set("corrupt.sqlite3", result);

			const formatted = formatHealthCheckResults(results);
			expect(formatted).toContain("DATABASE HEALTH CHECK FAILED");
			expect(formatted).toContain("corrupted databases");
		});

		it("should show success message when all databases are healthy", () => {
			const results = new Map();
			// Empty or no databases should show success
			const formatted = formatHealthCheckResults(results);
			expect(formatted).toContain("No existing databases found");
		});
	});
});

describe("Sync Server Startup", () => {
	beforeEach(() => {
		cleanup();
	});

	afterEach(() => {
		cleanup();
	});

	it("should detect and report database corruption before starting", () => {
		// This test verifies the integration point - if a database is corrupt,
		// the health check should fail and prevent server startup
		const dbPath = createCorruptDb("corrupt.sqlite3");
		const result = checkDatabaseHealth(dbPath, extensionPath);

		expect(result.ok).toBe(false);

		// The formatted output should contain actionable advice
		const results = new Map();
		results.set("corrupt.sqlite3", result);
		const formatted = formatHealthCheckResults(results);

		expect(formatted).toContain("Restore from a backup");
		expect(formatted).toContain("Delete the corrupted database");
	});
});
