import * as http from "http";
import express from "express";
import cors from "cors";
import path from "path";
import fs from "fs";

import { attachWebsocketServer, type IDB } from "@vlcn.io/ws-server";
import touchHack from "@vlcn.io/ws-server/dist/fs/touchHack.js";
import { extensionPath } from "@vlcn.io/crsqlite";

import { performStartupHealthCheck, checkDatabaseHealth, checkAllDatabases } from "./db-health.js";

const IS_DEV = process.env.IS_DEV === "true";
const SKIP_HEALTH_CHECK = process.env.SKIP_HEALTH_CHECK === "true";
const PORT = process.env.PORT || 3000;
const DB_FOLDER = process.env.DB_FOLDER || "./test-dbs";
const SCHEMA_FOLDER = process.env.SCHEMA_FOLDER || "./schemas";

// Create the DB folder if it doesn't exist
if (!fs.existsSync(path.resolve(DB_FOLDER))) {
	fs.mkdirSync(DB_FOLDER, { recursive: true });
}

// Perform database health checks before starting the server
// This will exit the process if critical errors are found
if (!SKIP_HEALTH_CHECK) {
	performStartupHealthCheck(path.resolve(DB_FOLDER), extensionPath);
} else {
	console.warn("WARNING: Database health checks skipped (SKIP_HEALTH_CHECK=true)");
}

const app = express();
const server = http.createServer(app);

const wsConfig = {
	dbFolder: DB_FOLDER,
	schemaFolder: SCHEMA_FOLDER,
	pathPattern: /\/sync/,
	notifyPolling: true
};

const schemaName = "init";

const dbCache = attachWebsocketServer(server, wsConfig);
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
	const results = checkAllDatabases(path.resolve(DB_FOLDER), extensionPath);
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

	dbProvider.use(req.params.dbname, schemaName, (idb) => {
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
		const dbPath = path.resolve(wsConfig.dbFolder!, dbname);
		const metaPath = `${dbPath}.meta.json`;

		let meta: { siteId: string; schemaName?: string; schemaVersion?: string } | null = null;

		// Ensure the DB exists on disk before returning metadata
		await dbCache.use(dbname, schemaName, (idb: IDB) => {
			meta = {
				siteId: Buffer.from(idb.siteId).toString("hex"),
				schemaName: idb.schemaName,
				schemaVersion: idb.schemaVersion?.toString()
			};
		});

		if (!meta || !meta.siteId) {
			return res.status(500).json({ message: `Metadata not available for DB ${dbname}` });
		}

		fs.writeFileSync(metaPath, JSON.stringify(meta), "utf-8");

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
		await dbCache.use(dbname, schemaName, (idb) => {
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

// Bind only to localhost for security (not accessible from network)
server.listen(Number(PORT), "127.0.0.1", () => {
	console.log("info", `listening on http://127.0.0.1:${PORT}!`);
});

// Gracefully shut down the server on process termination
const shutdown = (signal: string) => {
	console.log("info", `[${signal}] Shutting down server...`);
	server.close(() => {
		console.log("info", "Server closed");
		process.exit(0);
	});
};

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
