import * as http from "http";
import { attachWebsocketServer } from "@vlcn.io/ws-server";
import express from "express";

const PORT = process.env.PORT || 3000;
const app = express();
const server = http.createServer(app);

const wsConfig = {
	dbFolder: "./dbs",
	schemaFolder: "./src/schemas",
	pathPattern: /\/sync/,
};

attachWebsocketServer(server, wsConfig);

app.use(express.json());

app.post("/data", (req, res) => {
	const data = req.body;

	// Here you would add the logic to write `data` to your database.
	// For example, if using a file-based database, you might use fs.writeFile or similar.
	// If using a more complex database, you would use the appropriate library/methods.

	console.log("Received data:", data);
	res.status(201).send("Data received and stored");
});

app.get("/", (_, res) => {
	res.send("Ok");
});

server.listen(PORT, () =>
	console.log("info", `listening on http://localhost:${PORT}!`)
);

