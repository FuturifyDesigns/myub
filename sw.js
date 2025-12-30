// sw.js - Service Worker for MyUB PWA
const CACHE_NAME = 'myub-v1';
const urlsToCache = [
  '/',
  '/dashboard.html',
  '/gpa-calculator.html',
  '/schedule.html',
  '/notes.html',
  '/study-groups.html',
  '/messages.html',
  '/friends.html',
  '/profile.html',
  '/myub-calls.js',
  '/myub-utils.js',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png'
];

// Install event
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
  );
});

// Activate event
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

// Fetch event
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        if (response) {
          return response;
        }
        return fetch(event.request);
      })
  );
});

// Background sync for notifications
self.addEventListener('sync', event => {
  if (event.tag === 'check-notifications') {
    console.log('Background sync: Checking notifications');
    event.waitUntil(checkNotifications());
  }
});

// Push notification event
self.addEventListener('push', event => {
  console.log('Push notification received:', event);
  
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = {
      title: 'MyUB',
      body: 'New notification',
      icon: '/icons/icon-192x192.png',
      badge: '/icons/icon-96x96.png'
    };
  }
  
  const options = {
    body: data.body || 'New notification from MyUB',
    icon: data.icon || '/icons/icon-192x192.png',
    badge: data.badge || '/icons/icon-96x96.png',
    vibrate: [100, 50, 100],
    data: {
      url: data.url || '/dashboard.html',
      timestamp: Date.now()
    },
    actions: [
      {
        action: 'open',
        title: 'Open App'
      },
      {
        action: 'dismiss',
        title: 'Dismiss'
      }
    ]
  };
  
  event.waitUntil(
    self.registration.showNotification(data.title || 'MyUB', options)
  );
});

// Notification click event
self.addEventListener('notificationclick', event => {
  console.log('Notification clicked:', event.notification.tag);
  event.notification.close();
  
  if (event.action === 'open') {
    event.waitUntil(
      clients.matchAll({ type: 'window', includeUncontrolled: true })
        .then(windowClients => {
          for (let client of windowClients) {
            if (client.url.includes('/dashboard.html') && 'focus' in client) {
              return client.focus();
            }
          }
          if (clients.openWindow) {
            return clients.openWindow('/dashboard.html');
          }
        })
    );
  }
});

// Function to check for notifications in background
async function checkNotifications() {
  try {
    console.log('Service Worker: Checking for notifications in background');
    
    // Update badge count
    if ('setAppBadge' in navigator) {
      const unreadCount = 1; // You would fetch this from your API
      await navigator.setAppBadge(unreadCount);
      console.log('Service Worker: Badge updated to', unreadCount);
    }
    
  } catch (error) {
    console.error('Service Worker: Error checking notifications:', error);
  }
}