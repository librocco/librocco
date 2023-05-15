self.onactivate = function (event) {
	console.log("This is the sw activated");
};

self.addEventListener("install", async (event) => {
	try {
		const cacheName = "pwa-assets";
		const cache = await caches.open(cacheName);
		const urlsToCache = ["/preview", "index.html", "favicon.ico", "android-chrome-512x512.png"];

		await cache.addAll(urlsToCache);
		console.log(urlsToCache.length + " files were cached on " + cacheName);
	} catch (error) {
		console.log("Error while caching multiple files. " + error.message);
	}
});

self.addEventListener("fetch", (event) => {
	event.respondWith(
		caches.match(event.request).then((cachedResponse) => {
			console.log(event.request);
			console.log({ cachedResponse });
			// It can update the cache to serve updated content on the next request
			return cachedResponse || fetch(event.request).catch((error) => console.log("Failed to fetch resources " + error));
		})
	);

	console.log("Cached assets were fetched");
});
 