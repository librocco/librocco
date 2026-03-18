import path from "path";

export const SQLITE_DATABASE_EXTENSIONS = new Set([".sqlite3", ".sqlite", ".db"]);

/**
 * Checks whether a file name points to a primary SQLite database file supported by sync-server.
 *
 * @param fileName file name from the DB folder
 * @returns true when the file should be treated as a database candidate
 */
export function isSupportedDatabaseFileName(fileName: string): boolean {
	if (fileName.endsWith("-wal") || fileName.endsWith("-shm")) {
		return false;
	}

	return SQLITE_DATABASE_EXTENSIONS.has(path.extname(fileName));
}
