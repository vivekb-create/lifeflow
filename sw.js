// LifeFlow Service Worker
// Handles: offline caching, background sync, update notifications

const CACHE_NAME     = 'lifeflow-v1';
const OFFLINE_URL    = '/lifeflow/';

// Assets to cache immediately on install
const PRECACHE_URLS = [
  '/lifeflow/',
  '/lifeflow/index.html',
  'https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;1,300;1,400&family=DM+Sans:wght@300;400;500&display=swap',
  'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js',
];

// ── INSTALL: precache shell ───────────────────────────────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      // Cache what we can, ignore failures for CDN resources
      return Promise.allSettled(
        PRECACHE_URLS.map(url => cache.add(url).catch(() => {}))
      );
    }).then(() => self.skipWaiting())
  );
});

// ── ACTIVATE: clean old caches ────────────────────────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames =>
      Promise.all(
        cacheNames
          .filter(name => name !== CACHE_NAME)
          .map(name => caches.delete(name))
      )
    ).then(() => self.clients.claim())
  );
});

// ── FETCH: cache-first for assets, network-first for API/Firebase ─────────────
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Never intercept Firebase, Google APIs, UPI requests
  if (
    url.hostname.includes('firebase') ||
    url.hostname.includes('googleapis.com') ||
    url.hostname.includes('firestore') ||
    url.hostname.includes('identitytoolkit') ||
    url.hostname.includes('resend.com') ||
    url.hostname.includes('workers.dev') ||
    request.method !== 'GET'
  ) {
    return; // Let these go straight to network
  }

  // For navigation requests (HTML pages) — network first, fallback to cache
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then(response => {
          // Cache the latest version of the page
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
          return response;
        })
        .catch(() =>
          caches.match(OFFLINE_URL).then(cached =>
            cached || new Response(
              offlinePage(),
              { headers: { 'Content-Type': 'text/html' } }
            )
          )
        )
    );
    return;
  }

  // For fonts, scripts, styles — cache first, then network
  if (
    url.hostname.includes('fonts.googleapis.com') ||
    url.hostname.includes('fonts.gstatic.com') ||
    url.hostname.includes('cdnjs.cloudflare.com') ||
    request.destination === 'script' ||
    request.destination === 'style' ||
    request.destination === 'font'
  ) {
    event.respondWith(
      caches.match(request).then(cached =>
        cached || fetch(request).then(response => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
          return response;
        })
      )
    );
    return;
  }
});

// ── MESSAGE: handle update checks from main thread ────────────────────────────
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  if (event.data && event.data.type === 'CHECK_UPDATE') {
    // Notify all clients that an update is available
    self.clients.matchAll().then(clients => {
      clients.forEach(client => client.postMessage({ type: 'UPDATE_AVAILABLE' }));
    });
  }
});

// ── PUSH NOTIFICATIONS (for future use) ──────────────────────────────────────
self.addEventListener('push', event => {
  if (!event.data) return;
  let data = {};
  try { data = event.data.json(); } catch { data = { title: 'LifeFlow', body: event.data.text() }; }
  event.waitUntil(
    self.registration.showNotification(data.title || 'LifeFlow', {
      body:    data.body  || 'You have a new notification',
      icon:    '/lifeflow/icons/icon-192.png',
      badge:   '/lifeflow/icons/icon-96.png',
      tag:     data.tag   || 'lifeflow-notif',
      data:    data.url   || '/lifeflow/',
      vibrate: [200, 100, 200],
    })
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then(clientList => {
      for (const client of clientList) {
        if (client.url === event.notification.data && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) return clients.openWindow(event.notification.data || '/lifeflow/');
    })
  );
});

// ── Offline fallback page ─────────────────────────────────────────────────────
function offlinePage() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>LifeFlow — Offline</title>
<style>
  body{font-family:'DM Sans',Arial,sans-serif;background:#F8F5EF;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;margin:0;color:#1C1C1A;}
  .logo{font-family:Georgia,serif;font-size:36px;font-style:italic;color:#3D5C42;margin-bottom:8px;}
  h2{font-size:20px;color:#3D5C42;margin-bottom:8px;font-weight:400;}
  p{font-size:14px;color:#5C5C58;text-align:center;max-width:280px;line-height:1.6;}
  button{margin-top:20px;padding:12px 28px;background:#3D5C42;color:white;border:none;border-radius:10px;font-size:14px;cursor:pointer;font-family:inherit;}
</style>
</head>
<body>
  <div class="logo">LifeFlow</div>
  <h2>You're offline 🌿</h2>
  <p>Your data is safely stored on your device. Connect to the internet to sync with your account.</p>
  <button onclick="location.reload()">Try again</button>
</body>
</html>`;
}
