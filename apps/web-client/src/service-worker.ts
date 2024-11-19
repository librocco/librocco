/// <reference lib="webworker" />

import { build, files, version } from '$service-worker';

const CACHE_NAME = `cache-${version}`;

// List of application assets to cache
const ASSETS = [
  ...build, // app-level assets (e.g., main.js)
  ...files  // static files (e.g., images, fonts)
];

// Install event: cache assets
self.addEventListener('install', (event: ExtendableEvent) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
});

// Activate event: clean up old caches
self.addEventListener('activate', (event: ExtendableEvent) => {
  event.waitUntil(
    caches.keys().then(async (keys) => {
      for (const key of keys) {
        if (key !== CACHE_NAME) {
          await caches.delete(key);
        }
      }
      // Immediately take control of all clients
      await (self as unknown as ServiceWorkerGlobalScope).clients.claim();
    })
  );
});

// Fetch event: serve from cache or fetch from network
self.addEventListener('fetch', (event: FetchEvent) => {
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      return (
        cachedResponse ||
        fetch(event.request).catch(() => {
          // Optionally handle fetch errors (e.g., offline fallback)
        })
      );
    })
  );
});

// Listen for messages from the main thread
self.addEventListener('message', (event: ExtendableMessageEvent) => {
  const data = event.data;

  if (data && data.type === 'CHECK_FOR_UPDATE') {
    checkForUpdates();
  }

  if (data && data.type === 'SKIP_WAITING') {
    // Activate the new service worker immediately
    (self as unknown as ServiceWorkerGlobalScope).skipWaiting();
  }
});

// Function to check for updates
async function checkForUpdates() {
  try {
    // Get the current scope of the service worker
    const scope = (self as unknown as ServiceWorkerGlobalScope).registration.scope;
    const versionUrl = new URL('/__version__.json', scope).pathname;
    
    const response = await fetch(versionUrl, {
      cache: 'no-store'
    });
    
    if (!response.ok) {
      console.error('Failed to fetch version info:', response.status);
      return;
    }

    const registration = await (self as unknown as ServiceWorkerGlobalScope).registration;
    
    if (registration.waiting) {
      // Notify clients that a new version is available
      const clients = await (self as unknown as ServiceWorkerGlobalScope).clients.matchAll({
        includeUncontrolled: true,
        type: 'window',
      });

      for (const client of clients) {
        client.postMessage({ type: 'NEW_VERSION_AVAILABLE' });
      }
    }
  } catch (error) {
    console.error('Error checking for updates:', error);
  }
}
