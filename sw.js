// MyUB Service Worker v1.0
const CACHE_NAME = 'myub-cache-v1';
const OFFLINE_URL = 'offline.html';

// Files to cache for offline use
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/dashboard.html',
  '/gpa-calculator.html',
  '/schedule.html',
  '/study-groups.html',
  '/messages.html',
  '/friends.html',
  '/profile.html',
  '/notes.html',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
  '/manifest.json'
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  console.log('[ServiceWorker] Install');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[ServiceWorker] Caching static assets');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => self.skipWaiting())
      .catch((err) => console.log('[ServiceWorker] Cache failed:', err))
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[ServiceWorker] Activate');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => {
            console.log('[ServiceWorker] Removing old cache:', name);
            return caches.delete(name);
          })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
  // Skip non-GET requests
  if (event.request.method !== 'GET') return;
  
  // Skip Supabase API requests (always fetch from network)
  if (event.request.url.includes('supabase.co')) return;
  
  // Skip chrome-extension requests
  if (event.request.url.startsWith('chrome-extension://')) return;

  event.respondWith(
    caches.match(event.request)
      .then((cachedResponse) => {
        // Return cached response if found
        if (cachedResponse) {
          // Fetch updated version in background
          fetch(event.request)
            .then((response) => {
              if (response && response.status === 200) {
                caches.open(CACHE_NAME)
                  .then((cache) => cache.put(event.request, response));
              }
            })
            .catch(() => {});
          return cachedResponse;
        }

        // Otherwise fetch from network
        return fetch(event.request)
          .then((response) => {
            // Don't cache non-successful responses
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }

            // Clone response for caching
            const responseToCache = response.clone();
            caches.open(CACHE_NAME)
              .then((cache) => cache.put(event.request, responseToCache));

            return response;
          })
          .catch(() => {
            // If offline and requesting HTML, show offline page
            if (event.request.headers.get('accept').includes('text/html')) {
              return caches.match(OFFLINE_URL);
            }
          });
      })
  );
});

// Handle push notifications (future feature)
self.addEventListener('push', (event) => {
  console.log('[ServiceWorker] Push received');
  const options = {
    body: event.data ? event.data.text() : 'New notification from MyUB',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/favicon-48x48.png',
    vibrate: [100, 50, 100],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: 1
    }
  };
  event.waitUntil(
    self.registration.showNotification('MyUB', options)
  );
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  console.log('[ServiceWorker] Notification clicked');
  event.notification.close();
  event.waitUntil(
    clients.openWindow('/dashboard.html')
  );
});
