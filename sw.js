// MyUB Service Worker v2.0 - With Background Notification Support
const CACHE_NAME = 'myub-cache-v2';
const OFFLINE_URL = 'offline.html';

// Supabase configuration (will be set by page)
let SUPABASE_URL = '';
let SUPABASE_KEY = '';
let USER_ID = '';

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
  console.log('[ServiceWorker] Install v2.0');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[ServiceWorker] Caching static assets');
        return cache.addAll(STATIC_ASSETS).catch(err => {
          console.log('[ServiceWorker] Some assets failed to cache:', err);
        });
      })
      .then(() => self.skipWaiting())
      .catch((err) => console.log('[ServiceWorker] Install failed:', err))
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[ServiceWorker] Activate v2.0');
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

// Fetch event - serve from cache when offline
self.addEventListener('fetch', (event) => {
  // Skip non-GET requests
  if (event.request.method !== 'GET') return;
  
  // Skip chrome extensions
  if (event.request.url.startsWith('chrome-extension')) return;
  
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // Return cached version or fetch from network
        return response || fetch(event.request).catch(() => {
          // If offline and no cache, show offline page
          if (event.request.destination === 'document') {
            return caches.match(OFFLINE_URL);
          }
        });
      })
  );
});

// Listen for messages from the page to set Supabase config
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SET_SUPABASE_CONFIG') {
    SUPABASE_URL = event.data.url;
    SUPABASE_KEY = event.data.key;
    USER_ID = event.data.userId;
    console.log('[ServiceWorker] Supabase config set for user:', USER_ID);
  }
  
  if (event.data && event.data.type === 'CHECK_NOTIFICATIONS') {
    console.log('[ServiceWorker] Checking for notifications...');
    event.waitUntil(checkForNotifications());
  }
});

// Check for undelivered notifications
async function checkForNotifications() {
  if (!SUPABASE_URL || !SUPABASE_KEY || !USER_ID) {
    console.log('[ServiceWorker] No Supabase config, skipping check');
    
    // Notify page
    self.clients.matchAll().then(clients => {
      clients.forEach(client => {
        client.postMessage({
          type: 'SW_LOG',
          message: 'No Supabase config set'
        });
      });
    });
    return;
  }
  
  try {
    console.log('[ServiceWorker] Fetching notifications for user:', USER_ID);
    
    // Notify page we're checking
    self.clients.matchAll().then(clients => {
      clients.forEach(client => {
        client.postMessage({
          type: 'SW_LOG',
          message: 'Checking notifications for user: ' + USER_ID
        });
      });
    });
    
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/notification_queue?user_id=eq.${USER_ID}&delivered=eq.false&select=*`,
      {
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    if (!response.ok) {
      console.error('[ServiceWorker] Fetch failed:', response.status);
      
      // Notify page of error
      self.clients.matchAll().then(clients => {
        clients.forEach(client => {
          client.postMessage({
            type: 'SW_ERROR',
            message: 'Fetch failed: ' + response.status + ' ' + response.statusText
          });
        });
      });
      return;
    }
    
    const notifications = await response.json();
    console.log('[ServiceWorker] Found notifications:', notifications.length);
    
    // Notify page
    self.clients.matchAll().then(clients => {
      clients.forEach(client => {
        client.postMessage({
          type: 'SW_LOG',
          message: 'Found ' + notifications.length + ' notification(s)'
        });
      });
    });
    
    // Show each notification
    for (const notif of notifications) {
      await self.registration.showNotification(notif.title, {
        body: notif.body,
        icon: notif.icon || '/icons/icon-192x192.png',
        badge: notif.badge || '/icons/favicon-48x48.png',
        tag: notif.tag || 'myub-' + notif.id,
        data: notif.data || { url: '/dashboard.html' },
        requireInteraction: notif.require_interaction || false,
        vibrate: [200, 100, 200]
      });
      
      console.log('[ServiceWorker] Notification shown:', notif.title);
      
      // Mark as delivered
      await fetch(
        `${SUPABASE_URL}/rest/v1/notification_queue?id=eq.${notif.id}`,
        {
          method: 'PATCH',
          headers: {
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=minimal'
          },
          body: JSON.stringify({
            delivered: true,
            delivered_at: new Date().toISOString()
          })
        }
      );
      
      console.log('[ServiceWorker] Notification delivered:', notif.title);
      
      // Notify page
      self.clients.matchAll().then(clients => {
        clients.forEach(client => {
          client.postMessage({
            type: 'SW_NOTIFICATION_SHOWN',
            title: notif.title
          });
        });
      });
    }
    
    // Update badge
    if (notifications.length > 0) {
      if ('setAppBadge' in self.navigator) {
        await self.navigator.setAppBadge(notifications.length);
      }
    }
    
  } catch (error) {
    console.error('[ServiceWorker] Check notifications error:', error);
    
    // Notify page of error
    self.clients.matchAll().then(clients => {
      clients.forEach(client => {
        client.postMessage({
          type: 'SW_ERROR',
          message: error.message,
          stack: error.stack
        });
      });
    });
  }
}

// Periodic background sync to check for notifications
self.addEventListener('periodicsync', (event) => {
  console.log('[ServiceWorker] Periodic sync:', event.tag);
  if (event.tag === 'check-notifications') {
    event.waitUntil(checkForNotifications());
  }
});

// Background sync (one-time)
self.addEventListener('sync', (event) => {
  console.log('[ServiceWorker] Sync:', event.tag);
  if (event.tag === 'check-notifications') {
    event.waitUntil(checkForNotifications());
  }
});

// Handle push notifications (from push service)
self.addEventListener('push', (event) => {
  console.log('[ServiceWorker] Push notification received');
  
  let notificationData = {
    title: 'MyUB',
    body: 'You have a new notification',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/favicon-48x48.png',
    vibrate: [200, 100, 200],
    tag: 'myub-notification',
    requireInteraction: false
  };
  
  // Parse notification data if available
  if (event.data) {
    try {
      const pushData = event.data.json();
      notificationData = {
        title: pushData.title || notificationData.title,
        body: pushData.body || notificationData.body,
        icon: pushData.icon || notificationData.icon,
        badge: pushData.badge || notificationData.badge,
        vibrate: pushData.vibrate || notificationData.vibrate,
        tag: pushData.tag || notificationData.tag,
        requireInteraction: pushData.requireInteraction || notificationData.requireInteraction,
        data: pushData.data || notificationData.data
      };
    } catch (error) {
      console.error('[ServiceWorker] Error parsing push data:', error);
    }
  }
  
  event.waitUntil(
    self.registration.showNotification(notificationData.title, {
      body: notificationData.body,
      icon: notificationData.icon,
      badge: notificationData.badge,
      vibrate: notificationData.vibrate,
      tag: notificationData.tag,
      requireInteraction: notificationData.requireInteraction,
      data: notificationData.data,
      actions: notificationData.actions || []
    })
  );
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  console.log('[ServiceWorker] Notification clicked');
  event.notification.close();
  
  // Get the URL to open from notification data
  const urlToOpen = event.notification.data?.url || '/dashboard.html';
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // Check if there's already a window open
        for (const client of clientList) {
          if (client.url.includes(new URL(urlToOpen, self.location.origin).pathname) && 'focus' in client) {
            return client.focus();
          }
        }
        // No window open, open a new one
        if (clients.openWindow) {
          return clients.openWindow(urlToOpen);
        }
      })
  );
});
