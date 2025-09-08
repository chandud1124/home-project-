// AquaGuard Sense - Enhanced Service Worker for PWA
const CACHE_NAME = 'aquaguard-v3.0.0';
const OFFLINE_URL = '/offline.html';

// Resources to cache for offline functionality
const ESSENTIAL_CACHE_URLS = [
  '/',
  '/offline.html',
  '/manifest.json',
  '/favicon.svg'
];

// API endpoints that can work offline with cached data
const API_CACHE_PATTERNS = [
  /\/api\/tanks/,
  /\/api\/system\/status/,
  /\/api\/motor-events/,
  /\/api\/consumption/
];

// Install event - cache essential resources
self.addEventListener('install', event => {
  console.log('🔧 Service Worker installing...');
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('📦 Caching essential resources');
        return cache.addAll(ESSENTIAL_CACHE_URLS);
      })
      .then(() => {
        console.log('✅ Service Worker installed');
        return self.skipWaiting();
      })
      .catch(error => {
        console.error('❌ Service Worker installation failed:', error);
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', event => {
  console.log('🚀 Service Worker activating...');
  
  event.waitUntil(
    caches.keys()
      .then(cacheNames => {
        return Promise.all(
          cacheNames
            .filter(cacheName => cacheName !== CACHE_NAME)
            .map(cacheName => {
              console.log('🗑️ Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            })
        );
      })
      .then(() => {
        console.log('✅ Service Worker activated');
        return self.clients.claim();
      })
  );
});

// Fetch event - handle requests with offline-first strategy
self.addEventListener('fetch', event => {
  // Skip non-GET requests
  if (event.request.method !== 'GET') return;
  
  // Skip chrome-extension and other non-http requests
  if (!event.request.url.startsWith('http')) return;

  // Handle API requests with network-first, cache-fallback strategy
  if (API_CACHE_PATTERNS.some(pattern => pattern.test(event.request.url))) {
    event.respondWith(handleAPIRequest(event.request));
    return;
  }

  // Handle navigation requests
  if (event.request.mode === 'navigate') {
    event.respondWith(handleNavigationRequest(event.request));
    return;
  }

  // Handle static assets with cache-first strategy
  event.respondWith(handleStaticRequest(event.request));
});

// Network-first strategy for API requests
async function handleAPIRequest(request) {
  const cache = await caches.open(CACHE_NAME);
  
  try {
    // Try network first
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      // Cache successful API responses for offline use
      cache.put(request, networkResponse.clone());
      console.log('🌐 API response cached:', request.url);
    }
    
    return networkResponse;
  } catch (error) {
    console.log('🔄 Network failed, trying cache for:', request.url);
    
    // Network failed, try cache
    const cachedResponse = await cache.match(request);
    
    if (cachedResponse) {
      console.log('📦 Serving cached API response for:', request.url);
      // Add offline indicator header
      const offlineResponse = new Response(cachedResponse.body, {
        status: cachedResponse.status,
        statusText: cachedResponse.statusText,
        headers: {
          ...cachedResponse.headers,
          'X-Served-From': 'cache',
          'X-Offline-Mode': 'true'
        }
      });
      return offlineResponse;
    }

    // Return offline data for critical endpoints
    return getOfflineAPIResponse(request);
  }
}

// Handle navigation requests (page loads)
async function handleNavigationRequest(request) {
  try {
    // Try network first for navigation
    const networkResponse = await fetch(request);
    return networkResponse;
  } catch (error) {
    console.log('🔄 Navigation failed, serving offline page');
    
    // Network failed, serve offline page
    const cache = await caches.open(CACHE_NAME);
    const offlineResponse = await cache.match(OFFLINE_URL);
    
    return offlineResponse || new Response('Offline', { 
      status: 200, 
      headers: { 'Content-Type': 'text/html' }
    });
  }
}

// Cache-first strategy for static assets
async function handleStaticRequest(request) {
  const cache = await caches.open(CACHE_NAME);
  const cachedResponse = await cache.match(request);
  
  if (cachedResponse) {
    console.log('📦 Serving cached static asset:', request.url);
    return cachedResponse;
  }
  
  try {
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      cache.put(request, networkResponse.clone());
      console.log('🌐 Static asset cached:', request.url);
    }
    
    return networkResponse;
  } catch (error) {
    console.log('❌ Failed to load static asset:', request.url);
    return new Response('Asset not available offline', { status: 404 });
  }
}

// Generate offline responses for critical API endpoints
function getOfflineAPIResponse(request) {
  const url = new URL(request.url);
  
  // Mock responses for offline mode
  if (url.pathname.includes('/api/system/status')) {
    return new Response(JSON.stringify({
      id: 1,
      wifi_connected: false,
      battery_level: 0,
      temperature: 0,
      esp32_top_status: 'offline',
      esp32_sump_status: 'offline',
      timestamp: new Date().toISOString(),
      offline_mode: true
    }), {
      headers: { 
        'Content-Type': 'application/json',
        'X-Offline-Mode': 'true' 
      }
    });
  }
  
  if (url.pathname.includes('/api/tanks')) {
    return new Response(JSON.stringify([
      {
        id: 'offline-top',
        tank_type: 'top_tank',
        level_percentage: 0,
        timestamp: new Date().toISOString(),
        offline_mode: true
      },
      {
        id: 'offline-sump',
        tank_type: 'sump_tank',
        level_percentage: 0,
        timestamp: new Date().toISOString(),
        offline_mode: true
      }
    ]), {
      headers: { 
        'Content-Type': 'application/json',
        'X-Offline-Mode': 'true' 
      }
    });
  }
  
  return new Response(JSON.stringify({ 
    error: 'Data not available offline',
    offline_mode: true 
  }), {
    status: 503,
    headers: { 'Content-Type': 'application/json' }
  });
}

// Background sync for when connection is restored
self.addEventListener('sync', event => {
  console.log('🔄 Background sync triggered:', event.tag);
  
  if (event.tag === 'background-sync-tank-data') {
    event.waitUntil(syncTankData());
  }
  
  if (event.tag === 'background-sync-motor-commands') {
    event.waitUntil(syncMotorCommands());
  }
});

async function syncTankData() {
  console.log('📊 Syncing tank data...');
  // Implement tank data synchronization
  try {
    const response = await fetch('/api/tanks');
    if (response.ok) {
      const data = await response.json();
      // Notify clients about updated data
      notifyClients({ type: 'data-sync', data: data });
    }
  } catch (error) {
    console.error('Failed to sync tank data:', error);
  }
}

async function syncMotorCommands() {
  console.log('⚙️ Syncing motor commands...');
  // Implement motor command synchronization
  // This would handle any queued motor commands while offline
}

// Push notification handling
self.addEventListener('push', event => {
  console.log('🔔 Push notification received');
  
  const options = {
    body: 'AquaGuard system notification',
    icon: '/favicon.svg',
    badge: '/favicon.svg',
    tag: 'aquaguard-notification',
    vibrate: [200, 100, 200],
    actions: [
      {
        action: 'view',
        title: 'View Details',
        icon: '/favicon.svg'
      },
      {
        action: 'dismiss',
        title: 'Dismiss'
      }
    ],
    data: { timestamp: Date.now() }
  };

  if (event.data) {
    try {
      const payload = event.data.json();
      options.title = payload.title || 'AquaGuard Alert';
      options.body = payload.body || payload.message;
      options.data = payload.data || options.data;
      
      // Customize notification based on type
      if (payload.type === 'critical') {
        options.requireInteraction = true;
        options.vibrate = [300, 100, 300, 100, 300];
      }
    } catch (error) {
      console.error('Failed to parse push payload:', error);
      options.title = 'AquaGuard Notification';
    }
  } else {
    options.title = 'AquaGuard System Update';
  }

  event.waitUntil(
    self.registration.showNotification(options.title, options)
  );
});

// Notification click handling
self.addEventListener('notificationclick', event => {
  console.log('🔔 Notification clicked:', event.notification.tag);
  
  event.notification.close();

  if (event.action === 'view') {
    event.waitUntil(
      clients.openWindow('/')
    );
  } else if (event.action === 'dismiss') {
    // Just close the notification
    return;
  } else {
    // Default action - open app
    event.waitUntil(
      clients.matchAll().then(clientList => {
        if (clientList.length > 0) {
          return clientList[0].focus();
        }
        return clients.openWindow('/');
      })
    );
  }
});

// Message handling from client
self.addEventListener('message', event => {
  console.log('📨 Message from client:', event.data);
  
  if (event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data.type === 'GET_VERSION') {
    event.source.postMessage({
      type: 'VERSION',
      version: CACHE_NAME
    });
  }
});

// Utility function to notify all clients
function notifyClients(message) {
  self.clients.matchAll().then(clients => {
    clients.forEach(client => {
      client.postMessage(message);
    });
  });
}

console.log('🚀 AquaGuard Service Worker loaded successfully');
