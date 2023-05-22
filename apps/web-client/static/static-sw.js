self.onactivate = function (event) {
	console.log("This is the sw activated");
};

self.addEventListener("install", async (event) => {
	console.log("INSTALL");
	try {
		const cacheName = "pwa-assets-v1";
		const urlsToCache = [
			"/preview/inventory/stock/0-all/",
			"/preview/site.webmanifest",
			"/preview/favicon-32x32.png",
			"/preview/favicon-16x16.png"
		];
		const cache = await caches.open(cacheName);
		cache.addAll(urlsToCache);

		console.log(urlsToCache.length + " files were cached on " + cacheName);
	} catch (error) {
		console.log("Error while caching multiple files. " + error.message);
	}
});

self.addEventListener("fetch", (event) => {
	event.respondWith(
		(async () => {
			// cache first
			try {
				const cacheDir = await caches.open("pwa-assets-v1");
				const cachedResponse = await cacheDir.match(event.request);
				if (cachedResponse) {
					console.log({ cachedResponse });
					return cachedResponse;
				}
				const response = await fetch(event.request);
				console.log({ response });

				return response;
			} catch (e) {
				console.log("Failed to fetch resources via network", e);
			}
		})()
	);

	console.log("Assets were fetched");
});
