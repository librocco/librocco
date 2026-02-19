/**
 * Database Health Check Module
 *
 * Performs comprehensive sanity checks on the sync server database at startup.
 * Refuses to start with clear, actionable error messages if problems are detected.
 */

import Database from "better-sqlite3";
import fs from "fs";
import path from "path";

export interface HealthCheckResult {
	ok: boolean;
	checks: {
		name: string;
		passed: boolean;
		message: string;
		severity: "error" | "warning";
	}[];
}

interface CrsqlMasterRow {
	key: string;
	value: string;
}

interface SiteIdRow {
	site_id: Buffer;
	ordinal: number;
}

/**
 * Performs comprehensive health checks on a database file.
 * This should be called at server startup for each known database.
 */
export function checkDatabaseHealth(dbPath: string, extensionPath: string): HealthCheckResult {
	const checks: HealthCheckResult["checks"] = [];
	let db: Database.Database | null = null;

	// Check 1: File exists and is readable
	if (!fs.existsSync(dbPath)) {
		// New database - this is fine, it will be created on first access
		return {
			ok: true,
			checks: [
				{
					name: "file_exists",
					passed: true,
					message: `Database file does not exist yet (will be created on first connection): ${dbPath}`,
					severity: "warning"
				}
			]
		};
	}

	try {
		fs.accessSync(dbPath, fs.constants.R_OK | fs.constants.W_OK);
		checks.push({
			name: "file_accessible",
			passed: true,
			message: "Database file is readable and writable",
			severity: "error"
		});
	} catch (err) {
		checks.push({
			name: "file_accessible",
			passed: false,
			message: `Database file is not accessible: ${err instanceof Error ? err.message : String(err)}`,
			severity: "error"
		});
		return { ok: false, checks };
	}

	try {
		db = new Database(dbPath);

		// Check 2: SQLite integrity check
		const integrityResult = db.pragma("integrity_check") as { integrity_check: string }[];
		const integrityOk = integrityResult.length === 1 && integrityResult[0].integrity_check === "ok";
		checks.push({
			name: "sqlite_integrity",
			passed: integrityOk,
			message: integrityOk
				? "SQLite integrity check passed"
				: `SQLite integrity check failed: ${integrityResult.map((r) => r.integrity_check).join(", ")}`,
			severity: "error"
		});

		if (!integrityOk) {
			db.close();
			return { ok: false, checks };
		}

		// Check 3: Load crsqlite extension
		try {
			db.loadExtension(extensionPath);
			checks.push({
				name: "crsqlite_extension",
				passed: true,
				message: "CR-SQLite extension loaded successfully",
				severity: "error"
			});
		} catch (err) {
			checks.push({
				name: "crsqlite_extension",
				passed: false,
				message: `Failed to load CR-SQLite extension: ${err instanceof Error ? err.message : String(err)}`,
				severity: "error"
			});
			db.close();
			return { ok: false, checks };
		}

		// Check 4: Verify crsql_changes virtual table is accessible
		try {
			const changesCount = db.prepare("SELECT COUNT(*) as count FROM crsql_changes LIMIT 1").get() as { count: number };
			checks.push({
				name: "crsql_changes_accessible",
				passed: true,
				message: `crsql_changes virtual table is accessible (${changesCount.count} changes)`,
				severity: "error"
			});
		} catch (err) {
			checks.push({
				name: "crsql_changes_accessible",
				passed: false,
				message: `crsql_changes virtual table is NOT accessible: ${err instanceof Error ? err.message : String(err)}`,
				severity: "error"
			});
			db.close();
			return { ok: false, checks };
		}

		// Check 5: Verify crsql_master has valid schema info
		try {
			const masterRows = db.prepare("SELECT key, value FROM crsql_master").all() as CrsqlMasterRow[];
			const masterMap = new Map(masterRows.map((r) => [r.key, r.value]));

			const hasSchemaName = masterMap.has("schema_name");
			const hasSchemaVersion = masterMap.has("schema_version");
			const hasCrsqliteVersion = masterMap.has("crsqlite_version");

			if (hasSchemaName && hasSchemaVersion) {
				checks.push({
					name: "crsql_master_valid",
					passed: true,
					message: `crsql_master is valid: schema=${masterMap.get("schema_name")}, version=${masterMap.get("schema_version")}`,
					severity: "error"
				});
			} else {
				checks.push({
					name: "crsql_master_valid",
					passed: false,
					message: `crsql_master is missing required fields: schema_name=${hasSchemaName}, schema_version=${hasSchemaVersion}`,
					severity: "error"
				});
			}
		} catch (err) {
			checks.push({
				name: "crsql_master_valid",
				passed: false,
				message: `Failed to read crsql_master: ${err instanceof Error ? err.message : String(err)}`,
				severity: "error"
			});
		}

		// Check 6: Verify site_id consistency
		try {
			const siteIdRows = db.prepare("SELECT site_id, ordinal FROM crsql_site_id ORDER BY ordinal").all() as SiteIdRow[];
			if (siteIdRows.length === 0) {
				checks.push({
					name: "site_id_valid",
					passed: false,
					message: "No site_id found in crsql_site_id table",
					severity: "error"
				});
			} else {
				const primarySiteId = siteIdRows[0].site_id.toString("hex");
				checks.push({
					name: "site_id_valid",
					passed: true,
					message: `Primary site_id: ${primarySiteId} (${siteIdRows.length} total site(s) tracked)`,
					severity: "error"
				});

				// Warning if multiple site_ids (might indicate sync from multiple sources)
				if (siteIdRows.length > 1) {
					checks.push({
						name: "site_id_multiple",
						passed: true,
						message: `Multiple site_ids detected (${siteIdRows.length}). This is normal if syncing from multiple peers.`,
						severity: "warning"
					});
				}
			}
		} catch (err) {
			checks.push({
				name: "site_id_valid",
				passed: false,
				message: `Failed to read site_id: ${err instanceof Error ? err.message : String(err)}`,
				severity: "error"
			});
		}

		// Check 7: Verify clock tables exist and have reasonable data
		try {
			const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE '%__crsql_clock'").all() as {
				name: string;
			}[];

			if (tables.length === 0) {
				checks.push({
					name: "clock_tables_exist",
					passed: false,
					message: "No clock tables found - database may not have any CRDT-enabled tables",
					severity: "warning"
				});
			} else {
				// Check that clock tables have consistent db_version ranges
				let totalClockEntries = 0;
				let maxDbVersion = 0n;

				for (const table of tables) {
					const stats = db
						.prepare(`SELECT COUNT(*) as count, MAX(db_version) as max_v FROM "${table.name}"`)
						.get() as { count: number; max_v: bigint | null };
					totalClockEntries += stats.count;
					if (stats.max_v && stats.max_v > maxDbVersion) {
						maxDbVersion = stats.max_v;
					}
				}

				checks.push({
					name: "clock_tables_exist",
					passed: true,
					message: `${tables.length} clock table(s) found with ${totalClockEntries} total entries, max db_version: ${maxDbVersion}`,
					severity: "error"
				});
			}
		} catch (err) {
			checks.push({
				name: "clock_tables_exist",
				passed: false,
				message: `Failed to check clock tables: ${err instanceof Error ? err.message : String(err)}`,
				severity: "warning"
			});
		}

		db.close();
	} catch (err) {
		if (db) {
			try {
				db.close();
			} catch {
				// Ignore close errors
			}
		}
		checks.push({
			name: "database_open",
			passed: false,
			message: `Failed to open database: ${err instanceof Error ? err.message : String(err)}`,
			severity: "error"
		});
		return { ok: false, checks };
	}

	const hasErrors = checks.some((c) => !c.passed && c.severity === "error");
	return { ok: !hasErrors, checks };
}

/**
 * Checks health of all databases in a folder.
 * Returns a map of database name to health check result.
 */
export function checkAllDatabases(dbFolder: string, extensionPath: string): Map<string, HealthCheckResult> {
	const results = new Map<string, HealthCheckResult>();

	if (!fs.existsSync(dbFolder)) {
		return results; // Empty folder is OK, databases will be created on demand
	}

	const files = fs.readdirSync(dbFolder);
	const dbFiles = files.filter((f) => f.endsWith(".sqlite3") && !f.endsWith("-wal") && !f.endsWith("-shm"));

	for (const dbFile of dbFiles) {
		const dbPath = path.join(dbFolder, dbFile);
		results.set(dbFile, checkDatabaseHealth(dbPath, extensionPath));
	}

	return results;
}

/**
 * Formats health check results for console output.
 * Uses ANSI colors for visibility.
 */
export function formatHealthCheckResults(results: Map<string, HealthCheckResult>): string {
	const RED = "\x1b[31m";
	const GREEN = "\x1b[32m";
	const YELLOW = "\x1b[33m";
	const BOLD = "\x1b[1m";
	const RESET = "\x1b[0m";

	const lines: string[] = [];
	lines.push("");
	lines.push(`${BOLD}========================================${RESET}`);
	lines.push(`${BOLD}  DATABASE HEALTH CHECK RESULTS${RESET}`);
	lines.push(`${BOLD}========================================${RESET}`);
	lines.push("");

	if (results.size === 0) {
		lines.push(`${YELLOW}No existing databases found. New databases will be created on first connection.${RESET}`);
		lines.push("");
		return lines.join("\n");
	}

	let allHealthy = true;

	for (const [dbName, result] of results) {
		const statusIcon = result.ok ? `${GREEN}[OK]${RESET}` : `${RED}[FAILED]${RESET}`;
		lines.push(`${BOLD}Database: ${dbName}${RESET} ${statusIcon}`);

		for (const check of result.checks) {
			const checkIcon = check.passed ? `${GREEN}[PASS]${RESET}` : check.severity === "error" ? `${RED}[FAIL]${RESET}` : `${YELLOW}[WARN]${RESET}`;
			lines.push(`  ${checkIcon} ${check.name}: ${check.message}`);
		}
		lines.push("");

		if (!result.ok) {
			allHealthy = false;
		}
	}

	if (!allHealthy) {
		lines.push(`${RED}${BOLD}========================================${RESET}`);
		lines.push(`${RED}${BOLD}  DATABASE HEALTH CHECK FAILED!${RESET}`);
		lines.push(`${RED}${BOLD}========================================${RESET}`);
		lines.push("");
		lines.push(`${RED}${BOLD}The sync server cannot start with corrupted databases.${RESET}`);
		lines.push(`${RED}${BOLD}Please resolve the issues above before restarting.${RESET}`);
		lines.push("");
		lines.push(`${YELLOW}Possible actions:${RESET}`);
		lines.push(`  1. Restore from a backup`);
		lines.push(`  2. Delete the corrupted database file and let clients re-sync`);
		lines.push(`  3. Run SQLite recovery tools on the database`);
		lines.push("");
	} else {
		lines.push(`${GREEN}${BOLD}All database health checks passed!${RESET}`);
		lines.push("");
	}

	return lines.join("\n");
}

/**
 * Main startup health check function.
 * Call this at server startup. It will exit the process if critical errors are found.
 */
export function performStartupHealthCheck(dbFolder: string, extensionPath: string): void {
	console.log("Performing database health checks...");

	const results = checkAllDatabases(dbFolder, extensionPath);
	const output = formatHealthCheckResults(results);
	console.log(output);

	const hasFailures = Array.from(results.values()).some((r) => !r.ok);
	if (hasFailures) {
		console.error("Exiting due to database health check failures.");
		process.exit(1);
	}
}
