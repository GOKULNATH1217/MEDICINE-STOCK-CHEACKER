/**
 * MEDI-CARE PWA Service Worker
 * Cache-first strategy for app-shell assets to enable 100% offline functionality.
 */

const CACHE_NAME = 'medicare-cache-v1';
const ASSETS = [
    './',
    './index.html',
    './script.js',
    './style.css',
    './manifest.webmanifest',
    './ping.txt'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log('[SW] Pre-caching offline app shell...');
            return cache.addAll(ASSETS);
        }).then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(
                keys.map((key) => {
                    if (key !== CACHE_NAME) {
                        console.log('[SW] Removing old cache:', key);
                        return caches.delete(key);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (event) => {
    // Skip non-GET requests or heartbeat ping requests
    if (event.request.method !== 'GET') return;
    if (event.request.url.includes('ping.txt')) {
        event.respondWith(fetch(event.request).catch(() => new Response('OFFLINE', { status: 503 })));
        return;
    }

    event.respondWith(
        caches.match(event.request).then((cachedResponse) => {
            if (cachedResponse) {
                // Fetch updated version in background for stale-while-revalidate
                fetch(event.request).then((networkResponse) => {
                    if (networkResponse && networkResponse.status === 200) {
                        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, networkResponse));
                    }
                }).catch(() => { /* Offline fallback silence */ });
                return cachedResponse;
            }
            return fetch(event.request).then((networkResponse) => {
                if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
                    return networkResponse;
                }
                const responseToCache = networkResponse.clone();
                caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseToCache));
                return networkResponse;
            });
        }).catch(() => {
            if (event.request.headers.get('accept')?.includes('text/html')) {
                return caches.match('./index.html');
            }
        })
    );
});
