// Service Worker -- caches app shell for offline use
// Audio files are stored in IndexedDB (managed by app.js), not here.

const CACHE_NAME = 'music-player-v2';
const APP_SHELL = [
    './',
    './index.html',
    './style.css',
    './offline.js',
    './archive.js',
    './sync.js',
    './app.js',
];

// Install: cache app shell
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
    );
    self.skipWaiting();
});

// Activate: clean old caches
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) =>
            Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
        )
    );
    self.clients.claim();
});

// Fetch: serve from cache first, fall back to network
self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    // Don't cache cross-origin requests (API calls, fonts, audio streams)
    if (url.origin !== self.location.origin) return;

    event.respondWith(
        caches.match(event.request).then((cached) => {
            if (cached) return cached;
            return fetch(event.request).then((response) => {
                // Cache successful GET responses for app shell files
                if (response.ok && event.request.method === 'GET') {
                    const clone = response.clone();
                    caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
                }
                return response;
            });
        }).catch(() => {
            // Offline fallback for navigation requests
            if (event.request.mode === 'navigate') {
                return caches.match('./index.html');
            }
        })
    );
});
