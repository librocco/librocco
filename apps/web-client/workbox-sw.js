importScripts("https://storage.googleapis.com/workbox-cdn/releases/6.4.1/workbox-sw.js");

workbox.precaching.precacheAndRoute(self.__WB_MANIFEST);

// self.addEventListener("install", async () => {
// 	try {
// 		const cache = await caches.open("new-cache-v1");
// 		const urlsToCache = [
// 			"/preview/inventory/stock/0-all/",
// 			"/preview/site.webmanifest",
// 			"/preview/favicon-32x32.png",
// 			"/preview/favicon-16x16.png"
// 		];
// 		cache.addAll(urlsToCache);

// 		console.log(" files were cached on " + cache);
// 	} catch (e) {
// 		console.log("error caching" + e);
// 	}
// });
// self.addEventListener("activate", () => {
// 	console.log("activate");
// });

// self.addEventListener("fetch", (event) => {
// 	event.respondWith(
// 		(async () => {
// 			// cache first
// 			try {
// 				const cacheDir = await caches.open("new-cache-v1");
// 				const cachedResponse = await cacheDir.match(event.request);
// 				if (cachedResponse) {
// 					console.log({ cachedResponse });
// 					return cachedResponse;
// 				}
// 				const response = await fetch(event.request);
// 				console.log({ response });

// 				return response;
// 			} catch (e) {
// 				console.log("Failed to fetch resources via network", e);
// 			}
// 		})()
// 	);
// });
