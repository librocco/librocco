import { createServer as createHttpServer } from "http";
import { attachWebsocketServer } from "ws-server-fork"; // Uncomment and use your WebSocket server library
import type { PluginOption, HttpServer } from "vite";
import { createProxyMiddleware } from "http-proxy-middleware";

type Config = {
	dbFolder: string;
	schemaFolder: string;
	pathPattern: RegExp;
	port: number;
};

/**
 * Starts an http server at the provided port and attaches the ws server
 */
const createSyncServer = ({ port, ...wsConfig }: Config) => {
	const server = createHttpServer();

	attachWebsocketServer(server, wsConfig);

	// During HMR this will be reran. In those cases, as the server is already running,
	// this will throw an error. We catch that error (as the server will most likely be ok as it is).
	// For cases where the server can't be started (for, potentially, different issue), the error is logged out for manual handling.
	try {
		server.listen(port, () => console.log(`sync server active at port ${port}`));
	} catch (e) {
		console.error("failed to start ws server, error:", e);
	}

	return server;
};

/**
 * Creates a reverse proxy that proxies the requests (for sync ws server)
 * from all endpoints matching the path pattern, to the port the ws server is running on
 */
const proxyWSRequests = (server: HttpServer, config: Config) => {
	const proxy = createProxyMiddleware({
		target: `http://localhost:${config.port}`,
		changeOrigin: true,
		ws: true
	});

	server.on("upgrade", (req, _, head) => {
		// Check if connection should be routed to the sync server
		if (config.pathPattern.test(req.url)) {
			proxy.upgrade(req, req.socket, head);
		}
	});
};

const create = (config: Config): PluginOption => {
	return {
		name: "web-socket-sync-server",
		configureServer({ httpServer: server }) {
			createSyncServer(config);
			proxyWSRequests(server, config);
		}
	};
};

export default create;
