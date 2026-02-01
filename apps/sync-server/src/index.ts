import * as http from "http";
import express from "express";
import cors from "cors";
import path from "path";
import fs from "fs";

import { attachWebsocketServer, type IDB } from "@vlcn.io/ws-server";
import touchHack from "@vlcn.io/ws-server/dist/fs/touchHack.js";

const IS_DEV = process.env.IS_DEV === "true";
const PORT = process.env.PORT || 3000;
const DB_FOLDER = process.env.DB_FOLDER || "./test-dbs";
const SCHEMA_FOLDER = process.env.SCHEMA_FOLDER || "./schemas";

const app = express();
const server = http.createServer(app);

const wsConfig = {
	dbFolder: DB_FOLDER,
	schemaFolder: SCHEMA_FOLDER,
	pathPattern: /\/sync/,
	notifyPolling: true
};

// Create the DB folder if it doesn't exist
if (!fs.existsSync(path.resolve(wsConfig.dbFolder))) {
	fs.mkdirSync(wsConfig.dbFolder!, { recursive: true });
}

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

if (IS_DEV) {
	console.log("running sync server in dev mode:");
	console.log("  RPC endpoiont enabled");
	console.log("  use RemoteDB to interact with the server DB");
} else {
	console.log("running sync server in production mode:");
	console.log("  RPC endpoiont disabled");
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
