import { createServer as createHttpServer } from "http";
import { handler } from "../build/handler.js"; // Adjust the path as necessary
import { proxyWSRequests, createSyncServer } from "./server.js";
import express from "express";
import cors from "cors";

const server = createHttpServer();
const app = express(server);

const config = {
	dbFolder: "./static/test-dbs",
	schemaFolder: "./static/schemas",
	pathPattern: /\/sync/,
	port: 3001
};

createSyncServer(config);

proxyWSRequests(server, config);

app.use((req, res, next) => {
	res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
	res.setHeader("Cross-Origin-Embedder-Policy", "require-corp");
	next();
});

app.use(handler);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
	console.log(`Server running on port ${PORT}`);
});
