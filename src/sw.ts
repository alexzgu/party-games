/// <reference lib="webworker" />
import { cacheNames, clientsClaim } from 'workbox-core';
import { cleanupOutdatedCaches, createHandlerBoundToURL, getCacheKeyForURL, precacheAndRoute } from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';

declare const self: ServiceWorkerGlobalScope;

// Vite also adds the web manifest without a digest. The glob already includes it.
const manifest = self.__WB_MANIFEST.filter((entry) => typeof entry !== 'string').filter((entry) => entry.integrity);
void self.skipWaiting();
clientsClaim();
cleanupOutdatedCaches();
precacheAndRoute(manifest);
registerRoute(new NavigationRoute(createHandlerBoundToURL('index.html')));

async function refreshCache() {
  const cache = await caches.open(cacheNames.precache);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 45_000);
  try {
    await Promise.all(manifest.map(async (entry) => {
      const key = getCacheKeyForURL(entry.url)!;
      // The digest prevents a deploy during refresh from mixing files from two releases.
      const response = await fetch(new URL(entry.url, self.registration.scope), {
        cache: 'reload',
        integrity: entry.integrity,
        signal: controller.signal,
      });
      if (!response.ok) throw new Error('Could not refresh the app cache');
      await cache.put(key, response);
    }));
  } finally {
    controller.abort();
    clearTimeout(timer);
  }
}

let refreshing: Promise<void> | undefined;
self.addEventListener('message', (event) => {
  if (event.data !== 'refresh-app-cache' || !event.ports[0]) return;
  const port = event.ports[0];
  refreshing ??= refreshCache().finally(() => { refreshing = undefined; });
  event.waitUntil(refreshing.then(() => port.postMessage(true), () => port.postMessage(false)));
});
