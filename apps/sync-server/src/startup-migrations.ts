import fs from "fs";
import path from "path";

import type { IDB } from "@vlcn.io/ws-server";

const SQLITE_DB_EXTENSIONS = new Set([".sqlite3", ".sqlite", ".db"]);
const BACKUP_ROOT_DIRNAME = ".startup-migration-backups";
const BACKUP_FILE_SUFFIXES = ["", "-wal", "-shm", "-journal", ".meta.json"] as const;

export interface StartupMigrationLogger {
	log: (message: string) => void;
}

export interface StartupMigrationOptions {
	dbFolder: string;
	schemaName: string;
	useDatabase: <T>(dbName: string, schemaName: string, cb: (idb: IDB) => T | Promise<T>) => Promise<T>;
	logger?: StartupMigrationLogger;
}

/**
 * Returns the root directory where startup migration backups are stored.
 *
 * @param dbFolder folder containing sync server databases
 * @returns backup root directory
 */
export function getStartupMigrationBackupRoot(dbFolder: string): string {
	return path.join(dbFolder, BACKUP_ROOT_DIRNAME);
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
		.filter((entry) => entry.isFile() && isDatabaseFile(entry.name))
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
	const backupRunDir = createBackupRunDirectory(options.dbFolder);
	logger.log(`Creating startup migration backups in ${backupRunDir}`);

	for (const dbName of databaseFiles) {
		try {
			const copiedFiles = backupDatabaseFiles(options.dbFolder, dbName, backupRunDir);
			logger.log(`Backed up "${dbName}" (${copiedFiles.length} file(s)).`);

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

function isDatabaseFile(fileName: string): boolean {
	if (fileName.endsWith("-wal") || fileName.endsWith("-shm")) {
		return false;
	}

	return SQLITE_DB_EXTENSIONS.has(path.extname(fileName));
}

function createBackupRunDirectory(dbFolder: string): string {
	const runId = new Date().toISOString().replaceAll(":", "-").replaceAll(".", "-");
	const backupRunDir = path.join(getStartupMigrationBackupRoot(dbFolder), runId);
	fs.mkdirSync(backupRunDir, { recursive: true });
	return backupRunDir;
}

function backupDatabaseFiles(dbFolder: string, dbName: string, backupRunDir: string): string[] {
	const copiedFiles: string[] = [];

	for (const suffix of BACKUP_FILE_SUFFIXES) {
		const sourceName = `${dbName}${suffix}`;
		const sourcePath = path.join(dbFolder, sourceName);
		if (!fs.existsSync(sourcePath)) {
			continue;
		}

		const destinationPath = path.join(backupRunDir, sourceName);
		fs.copyFileSync(sourcePath, destinationPath);
		copiedFiles.push(sourceName);
	}

	if (copiedFiles.length === 0) {
		throw new Error(`Database file not found for backup: ${dbName}`);
	}

	return copiedFiles;
}
