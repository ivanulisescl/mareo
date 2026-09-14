/* Minimal service worker so Chrome treats CliMarEo as an installable PWA.
 * Avoid aggressive caching so GitHub Pages updates are not sticky. */
self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  event.respondWith(fetch(event.request));
});
