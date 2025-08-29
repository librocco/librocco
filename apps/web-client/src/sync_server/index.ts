import * as http from "http";
import { attachWebsocketServer, type IDB } from "@vlcn.io/ws-server";
import express from "express";
import cors from "cors";
import path from "path";

import touchHack from "@vlcn.io/ws-server/dist/fs/touchHack";

const PORT = process.env.PORT || 3000;
const app = express();
const server = http.createServer(app);

const wsConfig = {
	dbFolder: "./test-dbs",
	schemaFolder: "./src/lib/schemas",
	pathPattern: /\/sync/
};

const schemaName = "init";

const dbCache = attachWebsocketServer(server, wsConfig);
const dbProvider = {
	use: (dbname: string, schema: string, cb: (idb: IDB) => void) => {
		dbCache.use(dbname, schema, (idb) => {
			cb(idb);
			touchHack(path.resolve(wsConfig.dbFolder!, dbname));
		});
	}
};

app.use(cors());
app.use(express.json());

app.get("/", (_, res) => {
	res.send("Ok");
});

// NOTE: CRUD doesn't perform checks for required fields, but the CRUD part is temp and
// probably won't be used with production DB

app.post("/:dbname/exec", async (req, res) => {
	dbProvider.use(req.params.dbname, schemaName, (idb) => {
		try {
			const db = idb.getDB();
			const { sql, bind = [] } = req.body;
			const stmt = db.prepare(sql);

			if (stmt.reader) {
				const rows = stmt.all(bind);
				return res.json({ rows });
			}

			stmt.run(bind);
			return res.json({ rows: null });
		} catch (err) {
			return res.status(400).json({ isSQLiteError: true, message: err.message, code: err.code });
		}
	});
});

app.get("/:dbname/customers", async (req, res) => {
	dbProvider.use(req.params.dbname, schemaName, (idb) => {
		const db = idb.getDB();
		const stmt = db.prepare("SELECT * FROM customer");
		const customers = stmt.all();
		res.json(customers);
	});
});

app.get("/:dbname/customers/:id", async (req, res) => {
	dbProvider.use(req.params.dbname, schemaName, (idb) => {
		const db = idb.getDB();
		const { id } = req.params;
		const stmt = db.prepare("SELECT * FROM customer WHERE id = ?");
		const customer = stmt.get(id);
		if (customer) {
			res.json(customer);
		} else {
			res.status(404).send("Customer not found");
		}
	});
});

app.put("/:dbname/customers/:id", async (req, res) => {
	dbProvider.use(req.params.dbname, schemaName, (idb) => {
		const db = idb.getDB();
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
});

app.delete("/:dbname/customers/:id", async (req, res) => {
	dbProvider.use(req.params.dbname, schemaName, (idb) => {
		const db = idb.getDB();
		const { id } = req.params;
		const stmt = db.prepare("DELETE FROM customer WHERE id = ?");
		const info = stmt.run(id);
		if (info.changes > 0) {
			res.send("Customer deleted successfully");
		} else {
			res.status(404).send("Customer not found");
		}
	});
});

app.post("/:dbname/customer-order-lines", async (req, res) => {
	dbProvider.use(req.params.dbname, schemaName, (idb) => {
		const db = idb.getDB();
		const { customer_id, isbn, quantity } = req.body;
		const stmt = db.prepare("INSERT INTO customer_order_lines (customer_id, isbn, quantity) VALUES (?, ?, ?)");
		const info = stmt.run(customer_id, isbn, quantity);
		res.status(201).json({ id: info.lastInsertRowid });
	});
});

app.get("/:dbname/customer-order-lines/:customerId", async (req, res) => {
	dbProvider.use(req.params.dbname, schemaName, (idb) => {
		const db = idb.getDB();
		const { customerId } = req.params;
		const stmt = db.prepare("SELECT * FROM customer_order_lines WHERE customer_id = ?");
		const orderLines = stmt.all(customerId);
		if (orderLines.length > 0) {
			res.json(orderLines);
		} else {
			res.status(404).send("No order lines found for this customer");
		}
	});
});

app.put("/:dbname/customer-order-lines/:id", async (req, res) => {
	dbProvider.use(req.params.dbname, schemaName, (idb) => {
		const db = idb.getDB();
		const { id } = req.params;
		const { customer_id, isbn, quantity } = req.body;
		const stmt = db.prepare("UPDATE customer_order_lines SET customer_id = ?, isbn = ?, quantity = ? WHERE id = ?");
		const info = stmt.run(customer_id, isbn, quantity, id);
		if (info.changes > 0) {
			res.send("Order line updated successfully");
		} else {
			res.status(404).send("Order line not found");
		}
	});
});

app.delete("/:dbname/customer-order-lines/:id", async (req, res) => {
	dbProvider.use(req.params.dbname, schemaName, (idb) => {
		const db = idb.getDB();
		const { id } = req.params;
		const stmt = db.prepare("DELETE FROM customer_order_lines WHERE id = ?");
		const info = stmt.run(id);
		if (info.changes > 0) {
			res.send("Order line deleted successfully");
		} else {
			res.status(404).send("Order line not found");
		}
	});
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
