import * as http from "http";
import type { Socket } from "net";
import express from "express";
import cors from "cors";
import path from "path";
import fs from "fs";

import { attachWebsocketServer, internal, type Config, type IDB } from "@vlcn.io/ws-server";
import touchHack from "@vlcn.io/ws-server/dist/fs/touchHack.js";
import DBFactory from "@vlcn.io/ws-server/dist/DBFactory.js";
import { getResidentSchemaVersion } from "@vlcn.io/ws-server/dist/DB.js";
import { extensionPath } from "@vlcn.io/crsqlite";

import { performStartupHealthCheck, checkDatabaseHealth, checkAllDatabases } from "./db-health.js";
import { migrateDatabasesOnStartup } from "./startup-migrations.js";

const IS_DEV = process.env.IS_DEV === "true";
const SKIP_HEALTH_CHECK = process.env.SKIP_HEALTH_CHECK === "true";
const PORT = process.env.PORT || 3000;
const DB_FOLDER = path.resolve(process.env.DB_FOLDER || "./test-dbs");
const SCHEMA_FOLDER = path.resolve(process.env.SCHEMA_FOLDER || "./schemas");
const SCHEMA_NAME = process.env.SCHEMA_NAME || "init";
const STARTUP_MIGRATION_BACKUP_FOLDER = process.env.STARTUP_MIGRATION_BACKUP_FOLDER
	? path.resolve(process.env.STARTUP_MIGRATION_BACKUP_FOLDER)
	: undefined;
const STARTUP_MIGRATION_MAX_BACKUP_RUNS = parsePositiveInteger(
	process.env.STARTUP_MIGRATION_MAX_BACKUP_RUNS
);

// Create the DB folder if it doesn't exist
if (!fs.existsSync(DB_FOLDER)) {
	fs.mkdirSync(DB_FOLDER, { recursive: true });
}

// Perform database health checks before starting the server
// This will exit the process if critical errors are found
if (!SKIP_HEALTH_CHECK) {
	performStartupHealthCheck(DB_FOLDER, extensionPath);
} else {
	console.warn("WARNING: Database health checks skipped (SKIP_HEALTH_CHECK=true)");
}

const app = express();
const server = http.createServer(app);
const openSockets = new Set<Socket>();

server.on("connection", (socket) => {
	openSockets.add(socket);
	socket.on("close", () => {
		openSockets.delete(socket);
	});
});

const wsConfig = {
	dbFolder: DB_FOLDER,
	schemaFolder: SCHEMA_FOLDER,
	pathPattern: /\/sync/,
	notifyPolling: true
} satisfies Config;
const residentSchemaVersion = getResidentSchemaVersion(SCHEMA_NAME, wsConfig);
try {
	await runStartupMigrations();
} catch (err) {
	const message = err instanceof Error ? err.message : String(err);
	console.error(`Exiting due to startup migration failure: ${message}`);
	process.exit(1);
}

const dbCache = attachWebsocketServer(server, wsConfig);
const originalUnref = dbCache.unref.bind(dbCache) as (roomId: string) => Promise<void>;
dbCache.unref = async (roomId: string) => {
	try {
		await originalUnref(roomId);
	} catch (err) {
		if (err instanceof Error && err.message.includes("illegal state -- cannot find db cache entry")) {
			console.warn(`warn`, `Ignored duplicate unref for db cache entry ${roomId}`);
			return;
		}

		throw err;
	}
};

const dbProvider = {
	use: (dbname: string, schema: string, cb: (idb: IDB) => void) => {
		dbCache.use(dbname, schema, (idb) => {
			cb(idb);
			// Perform 'touchHack' - touching the database file, triggering FSNotifier of potential change (notifying clients via sync websocket server)
			touchHack(path.resolve(wsConfig.dbFolder!, dbname));
		});
	}
};

app.use(cors());
app.use(express.json());

app.get("/", (_, res) => {
	res.send("Ok");
});

// Health check endpoint - returns detailed database health status
app.get("/health", (_, res) => {
	const results = checkAllDatabases(DB_FOLDER, extensionPath);
	const allHealthy = Array.from(results.values()).every((r) => r.ok);

	const response: Record<string, unknown> = {
		status: allHealthy ? "healthy" : "unhealthy",
		databases: Object.fromEntries(
			Array.from(results.entries()).map(([name, result]) => [
				name,
				{
					ok: result.ok,
					checks: result.checks.map((c) => ({
						name: c.name,
						passed: c.passed,
						message: c.message,
						severity: c.severity
					}))
				}
			])
		)
	};

	res.status(allHealthy ? 200 : 503).json(response);
});

// Health check for a specific database
app.get("/:dbname/health", (req, res) => {
	const dbname = req.params.dbname;
	const dbPath = path.resolve(DB_FOLDER, dbname);

	const result = checkDatabaseHealth(dbPath, extensionPath);

	res.status(result.ok ? 200 : 503).json({
		database: dbname,
		ok: result.ok,
		checks: result.checks.map((c) => ({
			name: c.name,
			passed: c.passed,
			message: c.message,
			severity: c.severity
		}))
	});
});

if (IS_DEV) {
	console.log("running sync server in dev mode:");
	console.log("  RPC endpoint enabled");
	console.log("  use RemoteDB to interact with the server DB");
} else {
	console.log("running sync server in production mode:");
	console.log("  RPC endpoint disabled");
	console.log("  only access to the DB is via sync websocket server");
}

app.post("/:dbname/exec", async (req, res) => {
	if (!IS_DEV) {
		return res.status(403).json({ message: "Not allowed in production mode" });
	}

	dbProvider.use(req.params.dbname, SCHEMA_NAME, (idb) => {
		try {
			const db = idb.getDB();
			const { sql, bind = [] } = req.body;
			const stmt = db.prepare(sql);

			if (stmt.reader) {
				const rows = stmt.all(bind);
				touchHack(path.resolve(wsConfig.dbFolder!, req.params.dbname));
				return res.json({ rows });
			}

			stmt.run(bind);
			touchHack(path.resolve(wsConfig.dbFolder!, req.params.dbname));
			return res.json({ rows: null });
		} catch (err) {
			return res.status(400).json({ isSQLiteError: true, message: err.message, code: err.code });
		}
	});
});

app.get("/:dbname/meta", async (req, res) => {
	const dbname = req.params.dbname;

	try {
		let meta: { siteId: string; schemaName?: string; schemaVersion?: string } | null = null;

		// Ensure the DB exists on disk before returning metadata
		await dbCache.use(dbname, SCHEMA_NAME, (idb: IDB) => {
			meta = {
				siteId: Buffer.from(idb.siteId).toString("hex"),
				schemaName: idb.schemaName,
				schemaVersion: idb.schemaVersion?.toString()
			};
		});

		if (!meta || !meta.siteId) {
			return res.status(500).json({ message: `Metadata not available for DB ${dbname}` });
		}

		return res.json(meta);
	} catch (err) {
		const message = err instanceof Error ? err.message : "Unknown error";
		return res.status(500).json({ message: `Failed to read metadata for DB ${dbname}`, error: message });
	}
});

app.post("/:dbname/reset", async (req, res) => {
	if (!IS_DEV) {
		return res.status(403).json({ message: "Not allowed in production mode" });
	}

	const dbname = req.params.dbname;
	const dbPath = path.resolve(wsConfig.dbFolder!, dbname);

	try {
		// Remove DB and journaling files to force a fresh DB (new site_id) on next access
		for (const suffix of ["", "-wal", "-shm"]) {
			fs.rmSync(dbPath + suffix, { force: true });
		}
		fs.rmSync(dbPath + ".meta.json", { force: true });

		// Re-initialize the DB so subsequent metadata calls succeed immediately
		await dbCache.use(dbname, SCHEMA_NAME, (idb) => {
			const db = idb.getDB();
			db.prepare("SELECT 1").get();
		});

		return res.json({ ok: true });
	} catch (err) {
		const message = err instanceof Error ? err.message : "Unknown error";
		return res.status(500).json({ message: `Failed to reset DB ${dbname}`, error: message });
	}
});

app.get("/:dbname/file", async (req, res) => {
	const dbname = req.params.dbname;
	const dbPath = path.resolve(wsConfig.dbFolder!, dbname);
	if (!fs.existsSync(dbPath)) {
		return res.status(404).json({ message: `File not found: ${dbPath}` });
	}
	console.log("Serving file:", dbPath);
	return res.sendFile(dbPath);
});

server.listen(Number(PORT), "127.0.0.1", () => {
	console.log("info", `listening on http://127.0.0.1:${PORT}!`);
});

// Gracefully shut down the server on process termination
let shuttingDown = false;
const shutdown = (signal: string) => {
	if (shuttingDown) {
		console.warn("warn", `[${signal}] Shutdown already in progress, forcing exit`);
		process.exit(1);
	}
	shuttingDown = true;

	console.log("info", `[${signal}] Shutting down server...`);
	const forceCloseTimeout = setTimeout(() => {
		console.warn("warn", "Forcing shutdown: closing lingering sockets");
		for (const socket of openSockets) {
			socket.destroy();
		}
		process.exit(0);
	}, 5000);
	forceCloseTimeout.unref();

	for (const socket of openSockets) {
		// Close keep-alive and upgraded sockets; remaining ones will be force-closed on timeout.
		socket.end();
	}

	server.close(() => {
		clearTimeout(forceCloseTimeout);
		console.log("info", "Server closed");
		process.exit(0);
	});
};

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

async function runStartupMigrations(): Promise<void> {
	const startupDbCache = new internal.DBCache(wsConfig, null, new DBFactory());
	try {
		await migrateDatabasesOnStartup({
			dbFolder: DB_FOLDER,
			schemaName: SCHEMA_NAME,
			residentSchemaVersion,
			backupRootFolder: STARTUP_MIGRATION_BACKUP_FOLDER,
			maxBackupRuns: STARTUP_MIGRATION_MAX_BACKUP_RUNS,
			useDatabase: (dbName, schema, cb) => startupDbCache.use(dbName, schema, cb)
		});
	} finally {
		await startupDbCache.destroy();
	}
}

function parsePositiveInteger(rawValue: string | undefined): number | undefined {
	if (rawValue == null || rawValue.trim() === "") {
		return undefined;
	}

	const parsed = Number.parseInt(rawValue, 10);
	if (!Number.isFinite(parsed) || parsed < 1) {
		console.warn(
			`Ignoring invalid STARTUP_MIGRATION_MAX_BACKUP_RUNS=${rawValue}. Expected a positive integer.`
		);
		return undefined;
	}

	return parsed;
}
