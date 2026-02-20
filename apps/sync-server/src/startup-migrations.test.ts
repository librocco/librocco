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

function getSingleBackupRunDir(dbFolder: string): string {
	const backupRoot = getStartupMigrationBackupRoot(dbFolder);
	const entries = fs.readdirSync(backupRoot, { withFileTypes: true }).filter((entry) => entry.isDirectory());
	expect(entries).toHaveLength(1);
	return path.join(backupRoot, entries[0].name);
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
		fs.writeFileSync(path.join(testDir, "orders.sqlite3"), "db");
		fs.writeFileSync(path.join(testDir, "orders.sqlite3-wal"), "wal");
		fs.writeFileSync(path.join(testDir, "orders.sqlite3-shm"), "shm");
		fs.writeFileSync(path.join(testDir, "orders.sqlite3.meta.json"), '{"schema":"init"}');

		const useDatabase = vi.fn(async <T>(_: string, __: string, cb: (idb: IDB) => T | Promise<T>) => cb(createMockIdb()));
		const migratedCount = await migrateDatabasesOnStartup({
			dbFolder: testDir,
			schemaName: "init",
			useDatabase
		});

		expect(migratedCount).toBe(1);
		const backupRunDir = getSingleBackupRunDir(testDir);
		expect(fs.readFileSync(path.join(backupRunDir, "orders.sqlite3"), "utf-8")).toBe("db");
		expect(fs.readFileSync(path.join(backupRunDir, "orders.sqlite3-wal"), "utf-8")).toBe("wal");
		expect(fs.readFileSync(path.join(backupRunDir, "orders.sqlite3-shm"), "utf-8")).toBe("shm");
		expect(fs.readFileSync(path.join(backupRunDir, "orders.sqlite3.meta.json"), "utf-8")).toBe('{"schema":"init"}');
		expect(useDatabase).toHaveBeenCalledWith("orders.sqlite3", "init", expect.any(Function));
	});

	it("migrates stale schema versions before serving requests", async () => {
		const dbName = "legacy.sqlite3";
		const dbPath = path.join(testDir, dbName);

		const setupDb = new Database(dbPath);
		setupDb.loadExtension(extensionPath);
		setupDb.exec(fs.readFileSync(path.join(SCHEMA_FOLDER, "init"), "utf-8"));
		setupDb.prepare("INSERT OR REPLACE INTO crsql_master (key, value) VALUES (?, ?)").run("schema_name", "init");
		setupDb.prepare("INSERT OR REPLACE INTO crsql_master (key, value) VALUES (?, ?)").run("schema_version", 1);
		setupDb.close();

		const wsConfig = {
			dbFolder: testDir,
			schemaFolder: SCHEMA_FOLDER,
			pathPattern: /\/sync/,
			notifyPolling: true
		} satisfies Config;

		const dbCache = new internal.DBCache(wsConfig, null, new DBFactory());
		try {
			const migratedCount = await migrateDatabasesOnStartup({
				dbFolder: testDir,
				schemaName: "init",
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
		expect(migratedVersion).toBe(getResidentSchemaVersion("init", wsConfig));
		expect(migratedVersion).not.toBe(1n);
	});

	it("fails startup when a database migration fails", async () => {
		fs.writeFileSync(path.join(testDir, "broken.sqlite3"), "");

		await expect(
			migrateDatabasesOnStartup({
				dbFolder: testDir,
				schemaName: "init",
				useDatabase: async () => {
					throw new Error("broken db");
				}
			})
		).rejects.toThrow('Failed startup migration for database "broken.sqlite3": broken db');

		const backupRunDir = getSingleBackupRunDir(testDir);
		expect(fs.existsSync(path.join(backupRunDir, "broken.sqlite3"))).toBe(true);
	});
});
