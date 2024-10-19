import * as http from "http";
import { attachWebsocketServer } from "@vlcn.io/ws-server";
import express from "express";

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


app.use(express.json());

app.get("/", (_, res) => {
	res.send("Ok");
});

// Initialize the database
const db = await getInitializedDB("./test-dbs/dev");

// NOTE: CRUD doesn't perform checks for required fields, but the CRUD part is temp and
// probably won't be used with production DB

// Customer orders CRUD
//
app.post("/customers", (req, res) => {
	const { fullname, email, deposit } = req.body;
	const stmt = db.prepare("INSERT INTO customer (fullname, email, deposit) VALUES (?, ?, ?)");
	const info = stmt.run(fullname, email, deposit);
	res.status(201).json({ id: info.lastInsertRowid });
});

app.get("/customers", (req, res) => {
	const stmt = db.prepare("SELECT * FROM customer");
	const customers = stmt.all();
	res.json(customers);
});

app.get("/customers/:id", (req, res) => {
	const { id } = req.params;
	const stmt = db.prepare("SELECT * FROM customer WHERE id = ?");
	const customer = stmt.get(id);
	if (customer) {
		res.json(customer);
	} else {
		res.status(404).send("Customer not found");
	}
});

app.put("/customers/:id", (req, res) => {
	const { id } = req.params;
	const { fullname, email, deposit } = req.body;
	const stmt = db.prepare("UPDATE customer SET fullname = ?, email = ?, deposit = ? WHERE id = ?");
	const info = stmt.run(fullname, email, deposit, id);
	if (info.changes > 0) {
		res.send("Customer updated successfully");
	} else {
		res.status(404).send("Customer not found");
	}
});

app.delete("/customers/:id", (req, res) => {
	const { id } = req.params;
	const stmt = db.prepare("DELETE FROM customer WHERE id = ?");
	const info = stmt.run(id);
	if (info.changes > 0) {
		res.send("Customer deleted successfully");
	} else {
		res.status(404).send("Customer not found");
	}
});

// Customer order lines CRUD
app.post("/customer-order-lines", (req, res) => {
	const { customer_id, isbn, quantity } = req.body;
	const stmt = db.prepare("INSERT INTO customer_order_lines (customer_id, isbn, quantity) VALUES (?, ?, ?)");
	const info = stmt.run(customer_id, isbn, quantity);
	res.status(201).json({ id: info.lastInsertRowid });
});

app.get("/customer-order-lines/:customerId", (req, res) => {
	const { customerId } = req.params;
	const stmt = db.prepare("SELECT * FROM customer_order_lines WHERE customer_id = ?");
	const orderLines = stmt.all(customerId);
	if (orderLines.length > 0) {
		res.json(orderLines);
	} else {
		res.status(404).send("No order lines found for this customer");
	}
});

app.put("/customer-order-lines/:id", (req, res) => {
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

app.delete("/customer-order-lines/:id", (req, res) => {
	const { id } = req.params;
	const stmt = db.prepare("DELETE FROM customer_order_lines WHERE id = ?");
	const info = stmt.run(id);
	if (info.changes > 0) {
		res.send("Order line deleted successfully");
	} else {
		res.status(404).send("Order line not found");
	}
});


server.listen(PORT, () =>
	console.log("info", `listening on http://localhost:${PORT}!`)
);

