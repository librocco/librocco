// hooks.server.ts
import { createProxyMiddleware } from "http-proxy-middleware";
import type { Handle } from "@sveltejs/kit";

// Create the proxy middleware
const proxy = createProxyMiddleware({
	target: "http://localhost:3001", // WebSocket server
	changeOrigin: true, // Adjust origin header for proxied requests
	ws: true // Enable WebSocket proxying
});

export const handle: Handle = async ({ event, resolve }) => {
	if (event.url.pathname.startsWith("/sync")) {
		// Pass the request to the proxy
		return new Promise((resolveProxy, rejectProxy) => {
			proxy(event.request, {}, (err) => {
				if (err) rejectProxy(err);
				else resolveProxy();
			});
		});
	}

	// Handle other requests normally
	return resolve(event);
};
