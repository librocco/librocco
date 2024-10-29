import * as http from "http";
import { attachWebsocketServer } from "@vlcn.io/ws-server";
import express from "express";
import cors from "cors";

import { getInitializedDB } from "./db";

const PORT = process.env.PORT || 3000;
const app = express();
const server = http.createServer(app);

const wsConfig = {
	dbFolder: "./test-dbs",
	schemaFolder: "./src/schemas",
	pathPattern: /\/sync/,
};


attachWebsocketServer(server, wsConfig);


app.use(cors());
app.use(express.json());

app.get("/", (_, res) => {
	res.send("Ok");
});

// NOTE: CRUD doesn't perform checks for required fields, but the CRUD part is temp and
// probably won't be used with production DB

app.post("/:dbname/customers", async (req, res) => {
	const db = await getInitializedDB(`./test-dbs/${req.params.dbname}`);
	const { fullname, email, deposit } = req.body;
	const stmt = db.prepare("INSERT INTO customer (fullname, email, deposit) VALUES (?, ?, ?)");
	const info = stmt.run(fullname, email, deposit);
	res.status(201).json({ id: info.lastInsertRowid });
});

app.get("/:dbname/customers", async (req, res) => {
	const db = await getInitializedDB(`./test-dbs/${req.params.dbname}`);
	const stmt = db.prepare("SELECT * FROM customer");
	const customers = stmt.all();
	res.json(customers);
});

app.get("/:dbname/customers/:id", async (req, res) => {
	const db = await getInitializedDB(`./test-dbs/${req.params.dbname}`);
	const { id } = req.params;
	const stmt = db.prepare("SELECT * FROM customer WHERE id = ?");
	const customer = stmt.get(id);
	if (customer) {
		res.json(customer);
	} else {
		res.status(404).send("Customer not found");
	}
});

app.put("/:dbname/customers/:id", async (req, res) => {
	const db = await getInitializedDB(`./test-dbs/${req.params.dbname}`);
	const { id } = req.params;
	const { fullname, email, deposit } = req.body;
	const stmt = db.prepare(`
		INSERT INTO customer (id, fullname, email, deposit)
		VALUES (?, ?, ?, ?)
		ON CONFLICT(id) DO UPDATE SET
			fullname = excluded.fullname,
			email = excluded.email,
			deposit = excluded.deposit
	`);
	const info = stmt.run(id, fullname, email, deposit);
	if (info.changes > 0) {
		res.send("Customer upserted successfully");
	} else {
		res.status(500).send("Failed to upsert customer");
	}
});



server.listen(PORT, () => {
	console.log("info", `listening on http://localhost:${PORT}!`);
});

// Gracefully shut down the server on process termination
process.on("SIGINT", () => {
	console.log("info", "Shutting down server...");
	server.close(() => {
		console.log("info", "Server closed");
		process.exit(0);
	});
});

