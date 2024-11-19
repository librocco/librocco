/// <reference lib="webworker" />

import { build, files, version } from "$service-worker";

const CACHE_NAME = `cache-${version}`;

// List of application assets to cache
const ASSETS = [
	...build, // app-level assets (e.g., main.js)
	...files // static files (e.g., images, fonts)
];

// Install event: cache assets
self.addEventListener("install", (event: ExtendableEvent) => {
	event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)));
});

// Activate event: clean up old caches
self.addEventListener("activate", (event: ExtendableEvent) => {
	event.waitUntil(
		(async () => {
			const keys = await caches.keys();
			await Promise.all(
				keys.map((key) => {
					if (key !== CACHE_NAME) {
						return caches.delete(key);
					}
				})
			);
			await self.clients.claim();

			// Notify all clients that a new version is available
			self.clients.matchAll({ type: "window" }).then((clients) => {
				for (const client of clients) {
					client.postMessage({ type: "NEW_VERSION_AVAILABLE" });
				}
			});
		})()
	);
});

// Fetch event: serve from cache or fetch from network
self.addEventListener("fetch", (event: FetchEvent) => {
	event.respondWith(
		caches.match(event.request).then((cachedResponse) => {
			return (
				cachedResponse ||
				fetch(event.request).catch(() => {
					// Return a basic offline page for HTML requests
					if (event.request.headers.get("accept")?.includes("text/html")) {
						return caches.match("/offline.html");
					}
					// For other resources, return a simple error response
					return new Response("Offline - Resource unavailable", {
						status: 503,
						statusText: "Service Unavailable",
						headers: new Headers({
							"Content-Type": "text/plain"
						})
					});
				})
			);
		})
	);
});

// Listen for messages from the main thread
self.addEventListener("message", (event: ExtendableMessageEvent) => {
	if (event.data?.type === "SKIP_WAITING") {
		self.skipWaiting();
	}
});
