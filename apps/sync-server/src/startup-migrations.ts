import Database from "better-sqlite3";
import fs from "fs";
import path from "path";

import type { IDB } from "@vlcn.io/ws-server";

import { isSupportedDatabaseFileName } from "./database-files.js";

const BACKUP_ROOT_DIRNAME = ".startup-migration-backups";
const BACKUP_AUX_FILE_SUFFIXES = [".meta.json", "-wal", "-shm", "-journal"] as const;
const DEFAULT_MAX_BACKUP_RUNS = 5;

export interface StartupMigrationLogger {
	log: (message: string) => void;
}

export interface StartupMigrationOptions {
	dbFolder: string;
	schemaName: string;
	useDatabase: <T>(dbName: string, schemaName: string, cb: (idb: IDB) => T | Promise<T>) => Promise<T>;
	residentSchemaVersion?: bigint;
	backupRootFolder?: string;
	maxBackupRuns?: number;
	logger?: StartupMigrationLogger;
}

interface BackupOutcome {
	copiedFiles: string[];
	reusedExistingBackup: boolean;
}

interface DatabaseSchemaState {
	schemaName: string | null;
	schemaVersion: bigint | null;
}

/**
 * Returns the root directory where startup migration backups are stored.
 *
 * @param dbFolder folder containing sync server databases
 * @param backupRootFolder optional explicit backup folder
 * @returns backup root directory
 */
export function getStartupMigrationBackupRoot(dbFolder: string, backupRootFolder?: string): string {
	return backupRootFolder ?? path.join(dbFolder, BACKUP_ROOT_DIRNAME);
}

/**
 * Lists database files that should be opened for startup-time migration checks.
 *
 * @param dbFolder folder containing sync server database files
 * @returns sorted list of database file names that are eligible for startup migration checks
 */
export function getDatabaseFilesForStartupMigration(dbFolder: string): string[] {
	if (!fs.existsSync(dbFolder)) {
		return [];
	}

	return fs
		.readdirSync(dbFolder, { withFileTypes: true })
		.filter((entry) => entry.isFile() && isSupportedDatabaseFileName(entry.name))
		.map((entry) => entry.name)
		.sort((a, b) => a.localeCompare(b));
}

/**
 * Opens every known database through ws-server before listen(), ensuring stale schemas are migrated first.
 *
 * @param options migration options used to discover and open existing databases
 * @returns number of databases checked/opened during startup migration
 */
export async function migrateDatabasesOnStartup(options: StartupMigrationOptions): Promise<number> {
	const logger = options.logger ?? console;
	const databaseFiles = getDatabaseFilesForStartupMigration(options.dbFolder);

	if (databaseFiles.length === 0) {
		logger.log("No existing databases found for startup migration checks.");
		return 0;
	}

	logger.log(`Running startup migration checks on ${databaseFiles.length} database(s)...`);

	let backupRunDir: string | null = null;
	for (const dbName of databaseFiles) {
		try {
			const dbPath = path.join(options.dbFolder, dbName);
			if (shouldBackupBeforeOpening(dbPath, options.schemaName, options.residentSchemaVersion)) {
				if (backupRunDir == null) {
					backupRunDir = getOrCreateBackupRunDirectory(options, logger);
				}

				const backupOutcome = await backupDatabaseFiles(options.dbFolder, dbName, backupRunDir);
				if (backupOutcome.reusedExistingBackup) {
					logger.log(`Reused existing startup backup for "${dbName}" (${backupOutcome.copiedFiles.length} file(s)).`);
				} else {
					logger.log(`Backed up "${dbName}" (${backupOutcome.copiedFiles.length} file(s)).`);
				}
			} else {
				logger.log(`Skipping backup for "${dbName}" (schema already at target version).`);
			}

			await options.useDatabase(dbName, options.schemaName, (idb) => {
				// Touch the DB handle once to ensure open/init/migration work is exercised.
				idb.getDB().prepare("SELECT 1").get();
			});
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			throw new Error(`Failed startup migration for database "${dbName}": ${message}`, { cause: err });
		}
	}

	logger.log("Startup migration checks completed.");
	return databaseFiles.length;
}

function shouldBackupBeforeOpening(dbPath: string, schemaName: string, residentSchemaVersion?: bigint): boolean {
	if (residentSchemaVersion == null) {
		return true;
	}

	const currentSchemaState = readDatabaseSchemaState(dbPath);
	if (currentSchemaState.schemaName == null || currentSchemaState.schemaVersion == null) {
		return true;
	}

	if (currentSchemaState.schemaName !== schemaName) {
		return true;
	}

	return currentSchemaState.schemaVersion !== residentSchemaVersion;
}

function readDatabaseSchemaState(dbPath: string): DatabaseSchemaState {
	let db: Database.Database | null = null;
	try {
		db = new Database(dbPath, { readonly: true, fileMustExist: true });

		const schemaNameRow = db.prepare("SELECT value FROM crsql_master WHERE key = 'schema_name'").pluck().get() as unknown;
		const schemaVersionRow = db
			.prepare("SELECT value FROM crsql_master WHERE key = 'schema_version'")
			.safeIntegers(true)
			.pluck()
			.get() as unknown;

		return {
			schemaName: typeof schemaNameRow === "string" ? schemaNameRow : null,
			schemaVersion: coerceToBigInt(schemaVersionRow)
		};
	} catch {
		return {
			schemaName: null,
			schemaVersion: null
		};
	} finally {
		if (db != null) {
			try {
				db.close();
			} catch {
				// Ignore close errors while reading optional metadata.
			}
		}
	}
}

function coerceToBigInt(raw: unknown): bigint | null {
	if (typeof raw === "bigint") {
		return raw;
	}
	if (typeof raw === "number" && Number.isInteger(raw)) {
		return BigInt(raw);
	}
	if (typeof raw === "string" && raw.length > 0) {
		try {
			return BigInt(raw);
		} catch {
			return null;
		}
	}

	return null;
}

function getOrCreateBackupRunDirectory(options: StartupMigrationOptions, logger: StartupMigrationLogger): string {
	const backupRoot = getStartupMigrationBackupRoot(options.dbFolder, options.backupRootFolder);
	const runDirName = getBackupRunDirectoryName(options.schemaName, options.residentSchemaVersion);
	const backupRunDir = path.join(backupRoot, runDirName);
	const runDirExisted = fs.existsSync(backupRunDir);

	fs.mkdirSync(backupRunDir, { recursive: true });
	if (runDirExisted) {
		logger.log(`Reusing startup migration backup directory ${backupRunDir}`);
	} else {
		logger.log(`Creating startup migration backups in ${backupRunDir}`);
	}

	pruneBackupRuns(backupRoot, backupRunDir, options.maxBackupRuns ?? DEFAULT_MAX_BACKUP_RUNS, logger);
	return backupRunDir;
}

function getBackupRunDirectoryName(schemaName: string, residentSchemaVersion?: bigint): string {
	const safeSchemaName = schemaName.replaceAll(/[^a-zA-Z0-9._-]/g, "_");
	if (residentSchemaVersion == null) {
		return `${safeSchemaName}-target-unknown`;
	}

	return `${safeSchemaName}-to-${residentSchemaVersion.toString()}`;
}

function pruneBackupRuns(backupRoot: string, activeRunDir: string, maxBackupRuns: number, logger: StartupMigrationLogger): void {
	if (maxBackupRuns < 1 || !fs.existsSync(backupRoot)) {
		return;
	}

	const entries = fs
		.readdirSync(backupRoot, { withFileTypes: true })
		.filter((entry) => entry.isDirectory())
		.map((entry) => {
			const fullPath = path.join(backupRoot, entry.name);
			const stat = fs.statSync(fullPath);
			return {
				name: entry.name,
				fullPath,
				mtimeMs: stat.mtimeMs
			};
		})
		.sort((a, b) => b.mtimeMs - a.mtimeMs || a.name.localeCompare(b.name));

	const activeRunDirName = path.basename(activeRunDir);
	const keepDirectories = new Set<string>([activeRunDirName]);
	for (const entry of entries) {
		if (keepDirectories.size >= maxBackupRuns) {
			break;
		}
		keepDirectories.add(entry.name);
	}

	for (const entry of entries) {
		if (keepDirectories.has(entry.name)) {
			continue;
		}

		try {
			fs.rmSync(entry.fullPath, { recursive: true, force: true });
			logger.log(`Pruned old startup migration backup directory ${entry.fullPath}`);
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			logger.log(`Failed to prune backup directory ${entry.fullPath}: ${message}`);
		}
	}
}

async function backupDatabaseFiles(dbFolder: string, dbName: string, backupRunDir: string): Promise<BackupOutcome> {
	const sourceDatabasePath = path.join(dbFolder, dbName);
	if (!fs.existsSync(sourceDatabasePath)) {
		throw new Error(`Database file not found for backup: ${dbName}`);
	}

	const destinationDatabasePath = path.join(backupRunDir, dbName);
	const copiedFiles: string[] = [];
	let reusedExistingBackup = false;

	if (fs.existsSync(destinationDatabasePath)) {
		reusedExistingBackup = true;
	} else {
		await backupSqliteDatabase(sourceDatabasePath, destinationDatabasePath);
	}
	copiedFiles.push(dbName);

	for (const suffix of BACKUP_AUX_FILE_SUFFIXES) {
		const sourceName = `${dbName}${suffix}`;
		const sourcePath = path.join(dbFolder, sourceName);
		if (!fs.existsSync(sourcePath)) {
			continue;
		}

		const destinationPath = path.join(backupRunDir, sourceName);
		if (!fs.existsSync(destinationPath)) {
			fs.copyFileSync(sourcePath, destinationPath);
		}
		copiedFiles.push(sourceName);
	}

	return { copiedFiles, reusedExistingBackup };
}

async function backupSqliteDatabase(sourceDatabasePath: string, destinationDatabasePath: string): Promise<void> {
	const sourceDb = new Database(sourceDatabasePath, {
		readonly: true,
		fileMustExist: true
	});

	try {
		await sourceDb.backup(destinationDatabasePath);
	} finally {
		sourceDb.close();
	}
}
