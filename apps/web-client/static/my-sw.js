self.onactivate = function (event) {
	console.log("This is the sw activated");
};

self.addEventListener("install", async (event) => {
	try {
		const cacheName = "pwa-assets";
		const cache = await caches.open(cacheName);
		const urlsToCache = ["/", "index.html", "favicon.ico", "android-chrome-512x512.png"];

		await cache.addAll(urlsToCache);
		console.log(urlsToCache.length + " files were cached on " + cacheName);
	} catch (error) {
		console.log("Error while caching multiple files. " + error.message);
	}
});