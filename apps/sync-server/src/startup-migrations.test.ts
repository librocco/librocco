import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import Database from "better-sqlite3";
import fs from "fs";
import os from "os";
import path from "path";
import { fileURLToPath } from "url";

import { extensionPath } from "@vlcn.io/crsqlite";
import { internal, type Config, type IDB } from "@vlcn.io/ws-server";
import DBFactory from "@vlcn.io/ws-server/dist/DBFactory.js";
import { getResidentSchemaVersion } from "@vlcn.io/ws-server/dist/DB.js";

import {
	getDatabaseFilesForStartupMigration,
	getStartupMigrationBackupRoot,
	migrateDatabasesOnStartup
} from "./startup-migrations.js";

const SCHEMA_FOLDER = fileURLToPath(new URL("../schemas", import.meta.url));

const LEGACY_INIT_SCHEMA = `
CREATE TABLE IF NOT EXISTS customer (
	id INTEGER NOT NULL,
	display_id TEXT,
	fullname TEXT,
	email TEXT,
	phone TEXT,
	deposit DECIMAL,
	updated_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
	PRIMARY KEY (id)
);
SELECT crsql_as_crr('customer');
`;

let testDir: string;

function createTmpDir() {
	testDir = fs.mkdtempSync(path.join(os.tmpdir(), "sync-server-startup-migrations-"));
}

function cleanupTmpDir() {
	if (!testDir) {
		return;
	}

	fs.rmSync(testDir, { recursive: true, force: true });
}

function getBackupRunDirectories(dbFolder: string): string[] {
	const backupRoot = getStartupMigrationBackupRoot(dbFolder);
	if (!fs.existsSync(backupRoot)) {
		return [];
	}

	return fs
		.readdirSync(backupRoot, { withFileTypes: true })
		.filter((entry) => entry.isDirectory())
		.map((entry) => entry.name)
		.sort((a, b) => a.localeCompare(b));
}

function getSingleBackupRunDir(dbFolder: string): string {
	const backupRoot = getStartupMigrationBackupRoot(dbFolder);
	const runDirectories = getBackupRunDirectories(dbFolder);
	expect(runDirectories).toHaveLength(1);
	return path.join(backupRoot, runDirectories[0]);
}

function createMockIdb(): IDB {
	return {
		getDB: () =>
			({
				prepare: () => ({
					get: () => 1
				})
			}) as ReturnType<IDB["getDB"]>
	} as IDB;
}

function createSimpleSqliteDb(dbPath: string): void {
	const db = new Database(dbPath);
	db.exec(`
		CREATE TABLE IF NOT EXISTS sample (id INTEGER PRIMARY KEY, value TEXT NOT NULL);
		INSERT INTO sample (value) VALUES ('seed');
	`);
	db.close();
}

function createVersionTrackedDatabase(dbPath: string, schemaName: string, schemaVersion: bigint): void {
	const db = new Database(dbPath);
	db.exec(`CREATE TABLE IF NOT EXISTS crsql_master (key TEXT PRIMARY KEY NOT NULL, value TEXT);`);
	db.prepare("INSERT OR REPLACE INTO crsql_master (key, value) VALUES (?, ?)").run("schema_name", schemaName);
	db.prepare("INSERT OR REPLACE INTO crsql_master (key, value) VALUES (?, ?)").run("schema_version", schemaVersion.toString());
	db.close();
}

describe("startup migrations", () => {
	beforeEach(() => {
		createTmpDir();
	});

	afterEach(() => {
		cleanupTmpDir();
	});

	it("lists only sqlite database files for startup migration", () => {
		fs.writeFileSync(path.join(testDir, "orders.sqlite3"), "");
		fs.writeFileSync(path.join(testDir, "inventory.sqlite"), "");
		fs.writeFileSync(path.join(testDir, "cache.db"), "");
		fs.writeFileSync(path.join(testDir, "orders.sqlite3-wal"), "");
		fs.writeFileSync(path.join(testDir, "orders.sqlite3-shm"), "");
		fs.writeFileSync(path.join(testDir, "readme.txt"), "");
		fs.mkdirSync(path.join(testDir, "nested"), { recursive: true });

		const files = getDatabaseFilesForStartupMigration(testDir);
		expect(files).toEqual(["cache.db", "inventory.sqlite", "orders.sqlite3"]);
	});

	it("does nothing when no startup migration candidates exist", async () => {
		const useDatabase = vi.fn(async <T>(_: string, __: string, cb: (idb: IDB) => T | Promise<T>) => cb(createMockIdb()));
		const migratedCount = await migrateDatabasesOnStartup({
			dbFolder: testDir,
			schemaName: "init",
			useDatabase
		});

		expect(migratedCount).toBe(0);
		expect(useDatabase).not.toHaveBeenCalled();
		expect(fs.existsSync(getStartupMigrationBackupRoot(testDir))).toBe(false);
	});

	it("backs up existing database and sidecar files before migrating", async () => {
		createSimpleSqliteDb(path.join(testDir, "orders.sqlite3"));
		fs.writeFileSync(path.join(testDir, "orders.sqlite3-wal"), "wal");
		fs.writeFileSync(path.join(testDir, "orders.sqlite3-shm"), "shm");
		fs.writeFileSync(path.join(testDir, "orders.sqlite3.meta.json"), '{"schema":"init"}');

		const useDatabase = vi.fn(async <T>(_: string, __: string, cb: (idb: IDB) => T | Promise<T>) => cb(createMockIdb()));
		const migratedCount = await migrateDatabasesOnStartup({
			dbFolder: testDir,
			schemaName: "init",
			residentSchemaVersion: 2n,
			useDatabase
		});

		expect(migratedCount).toBe(1);
		const backupRunDir = getSingleBackupRunDir(testDir);
		expect(fs.existsSync(path.join(backupRunDir, "orders.sqlite3-wal"))).toBe(true);
		expect(fs.existsSync(path.join(backupRunDir, "orders.sqlite3-shm"))).toBe(true);
		expect(fs.readFileSync(path.join(backupRunDir, "orders.sqlite3.meta.json"), "utf-8")).toBe('{"schema":"init"}');

		const backupDb = new Database(path.join(backupRunDir, "orders.sqlite3"), { readonly: true, fileMustExist: true });
		const rowCount = backupDb.prepare("SELECT COUNT(*) FROM sample").pluck().get();
		backupDb.close();
		expect(rowCount).toBe(1);
		expect(useDatabase).toHaveBeenCalledWith("orders.sqlite3", "init", expect.any(Function));
	});

	it("skips backup when schema is already at the resident version", async () => {
		createVersionTrackedDatabase(path.join(testDir, "current.sqlite3"), "init", 42n);

		const useDatabase = vi.fn(async <T>(_: string, __: string, cb: (idb: IDB) => T | Promise<T>) => cb(createMockIdb()));
		const migratedCount = await migrateDatabasesOnStartup({
			dbFolder: testDir,
			schemaName: "init",
			residentSchemaVersion: 42n,
			useDatabase
		});

		expect(migratedCount).toBe(1);
		expect(useDatabase).toHaveBeenCalledOnce();
		expect(fs.existsSync(getStartupMigrationBackupRoot(testDir))).toBe(false);
	});

	it("migrates stale schema versions before serving requests", async () => {
		const dbName = "legacy.sqlite3";
		const dbPath = path.join(testDir, dbName);

		const legacySchemaFolder = path.join(testDir, "legacy-schemas");
		fs.mkdirSync(legacySchemaFolder, { recursive: true });
		fs.writeFileSync(path.join(legacySchemaFolder, "init"), LEGACY_INIT_SCHEMA);

		const legacyVersionConfig = {
			dbFolder: testDir,
			schemaFolder: legacySchemaFolder,
			pathPattern: /\/sync/,
			notifyPolling: true
		} satisfies Config;
		const legacySchemaVersion = getResidentSchemaVersion("init", legacyVersionConfig);

		const setupDb = new Database(dbPath);
		setupDb.loadExtension(extensionPath);
		setupDb.exec(LEGACY_INIT_SCHEMA);
		setupDb.prepare("INSERT OR REPLACE INTO crsql_master (key, value) VALUES (?, ?)").run("schema_name", "init");
		setupDb.prepare("INSERT OR REPLACE INTO crsql_master (key, value) VALUES (?, ?)").run("schema_version", legacySchemaVersion.toString());
		setupDb.close();

		const wsConfig = {
			dbFolder: testDir,
			schemaFolder: SCHEMA_FOLDER,
			pathPattern: /\/sync/,
			notifyPolling: true
		} satisfies Config;
		const residentSchemaVersion = getResidentSchemaVersion("init", wsConfig);

		const dbCache = new internal.DBCache(wsConfig, null, new DBFactory());
		try {
			const migratedCount = await migrateDatabasesOnStartup({
				dbFolder: testDir,
				schemaName: "init",
				residentSchemaVersion,
				useDatabase: (room, schema, cb) => dbCache.use(room, schema, cb)
			});

			expect(migratedCount).toBe(1);
		} finally {
			await dbCache.destroy();
		}

		const backupRunDir = getSingleBackupRunDir(testDir);
		expect(fs.existsSync(path.join(backupRunDir, dbName))).toBe(true);

		const db = new Database(dbPath);
		const rawVersion = db.prepare("SELECT value FROM crsql_master WHERE key = 'schema_version'").safeIntegers(true).pluck().get() as
			| bigint
			| number
			| string;
		db.close();

		const migratedVersion = BigInt(rawVersion);
		expect(migratedVersion).toBe(residentSchemaVersion);
		expect(migratedVersion).not.toBe(legacySchemaVersion);
	});

	it("fails startup when a database migration fails", async () => {
		createSimpleSqliteDb(path.join(testDir, "broken.sqlite3"));

		await expect(
			migrateDatabasesOnStartup({
				dbFolder: testDir,
				schemaName: "init",
				residentSchemaVersion: 2n,
				useDatabase: async () => {
					throw new Error("broken db");
				}
			})
		).rejects.toThrow('Failed startup migration for database "broken.sqlite3": broken db');

		const backupRunDir = getSingleBackupRunDir(testDir);
		expect(fs.existsSync(path.join(backupRunDir, "broken.sqlite3"))).toBe(true);
	});

	it("reuses the same backup directory across failed startup retries", async () => {
		createSimpleSqliteDb(path.join(testDir, "broken.sqlite3"));

		const options = {
			dbFolder: testDir,
			schemaName: "init",
			residentSchemaVersion: 2n,
			useDatabase: async () => {
				throw new Error("broken db");
			}
		};

		await expect(migrateDatabasesOnStartup(options)).rejects.toThrow();
		await expect(migrateDatabasesOnStartup(options)).rejects.toThrow();

		const runDirectories = getBackupRunDirectories(testDir);
		expect(runDirectories).toHaveLength(1);

		const backupRunDir = getSingleBackupRunDir(testDir);
		expect(fs.existsSync(path.join(backupRunDir, "broken.sqlite3"))).toBe(true);
	});

	it("prunes old backup runs based on maxBackupRuns", async () => {
		createSimpleSqliteDb(path.join(testDir, "stale.sqlite3"));

		const backupRoot = getStartupMigrationBackupRoot(testDir);
		fs.mkdirSync(path.join(backupRoot, "old-run-a"), { recursive: true });
		fs.mkdirSync(path.join(backupRoot, "old-run-b"), { recursive: true });
		fs.mkdirSync(path.join(backupRoot, "old-run-c"), { recursive: true });

		const useDatabase = vi.fn(async <T>(_: string, __: string, cb: (idb: IDB) => T | Promise<T>) => cb(createMockIdb()));
		await migrateDatabasesOnStartup({
			dbFolder: testDir,
			schemaName: "init",
			residentSchemaVersion: 5n,
			maxBackupRuns: 2,
			useDatabase
		});

		const runDirectories = getBackupRunDirectories(testDir);
		expect(runDirectories.length).toBeLessThanOrEqual(2);
		expect(runDirectories.some((name) => name.startsWith("init-to-5"))).toBe(true);
	});
});
