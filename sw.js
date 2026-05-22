// LifeFlow Service Worker v2
// Handles: offline caching, background sync, notification clicks

const CACHE_NAME  = 'lifeflow-v2';
const APP_URL     = '/lifeflow/';   // GitHub Pages base path — change if yours differs

// Assets to cache on install
const PRECACHE_URLS = [
  '/lifeflow/',
  '/lifeflow/index.html',
];

// ── INSTALL ───────────────────────────────────────────────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache =>
      Promise.allSettled(PRECACHE_URLS.map(url => cache.add(url).catch(() => {})))
    ).then(() => self.skipWaiting())
  );
});

// ── ACTIVATE ──────────────────────────────────────────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(names => Promise.all(names.filter(n => n !== CACHE_NAME).map(n => caches.delete(n))))
      .then(() => self.clients.claim())
  );
});

// ── FETCH ─────────────────────────────────────────────────────────────────────
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Never intercept Firebase, Google APIs, or non-GET requests
  if (
    url.hostname.includes('firebase') ||
    url.hostname.includes('googleapis.com') ||
    url.hostname.includes('firestore') ||
    url.hostname.includes('identitytoolkit') ||
    url.hostname.includes('workers.dev') ||
    request.method !== 'GET'
  ) return;

  // Navigation (HTML pages): network first, then cache
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then(res => {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(c => c.put(request, clone));
          return res;
        })
        .catch(() => caches.match(APP_URL).then(cached =>
          cached || new Response(offlinePage(), { headers: { 'Content-Type': 'text/html' } })
        ))
    );
    return;
  }

  // Fonts / scripts / styles: cache first, then network
  if (
    url.hostname.includes('fonts.googleapis.com') ||
    url.hostname.includes('fonts.gstatic.com') ||
    url.hostname.includes('cdnjs.cloudflare.com') ||
    ['script','style','font'].includes(request.destination)
  ) {
    event.respondWith(
      caches.match(request).then(cached =>
        cached || fetch(request).then(res => {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(c => c.put(request, clone));
          return res;
        })
      )
    );
  }
});

// ── MESSAGE ───────────────────────────────────────────────────────────────────
self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

// ── NOTIFICATION CLICK ────────────────────────────────────────────────────────
self.addEventListener('notificationclick', event => {
  event.notification.close();

  // data is an object: { url, page, tab }
  const data    = event.notification.data || {};
  const appBase = APP_URL;

  // Build the URL to open — add ?tab= so the app navigates to the right page
  let targetUrl = appBase;
  if (data.tab)  targetUrl = appBase + '?tab=' + data.tab;
  if (data.url)  targetUrl = data.url;

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      // If the app is already open in a tab/window, focus it and post a message
      for (const client of clientList) {
        const clientBase = client.url.split('?')[0].split('#')[0];
        if (clientBase.includes('/lifeflow')) {
          client.focus();
          // Tell the app which page to navigate to
          if (data.tab) {
            client.postMessage({ type: 'NAVIGATE', tab: data.tab });
          }
          return;
        }
      }
      // App not open — open it fresh with the tab param
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});

// ── PUSH (for future FCM support) ─────────────────────────────────────────────
self.addEventListener('push', event => {
  if (!event.data) return;
  let data = {};
  try { data = event.data.json(); } catch { data = { title: 'LifeFlow', body: event.data.text() }; }
  event.waitUntil(
    self.registration.showNotification(data.title || 'LifeFlow', {
      body:    data.body  || 'New notification',
      icon:    '/lifeflow/icons/icon-192.png',
      badge:   '/lifeflow/icons/icon-96.png',
      tag:     data.tag   || 'lifeflow',
      data:    { url: APP_URL, tab: data.tab || 'home' },
      vibrate: [200, 100, 200],
    })
  );
});

// ── OFFLINE PAGE ──────────────────────────────────────────────────────────────
function offlinePage() {
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>LifeFlow — Offline</title>
<style>
  body{font-family:'DM Sans',Arial,sans-serif;background:#F8F5EF;display:flex;flex-direction:column;
    align-items:center;justify-content:center;min-height:100vh;margin:0;color:#1C1C1A;}
  .logo{font-family:Georgia,serif;font-size:36px;font-style:italic;color:#3D5C42;margin-bottom:8px;}
  h2{font-size:20px;color:#3D5C42;margin-bottom:8px;font-weight:400;}
  p{font-size:14px;color:#5C5C58;text-align:center;max-width:280px;line-height:1.6;}
  button{margin-top:20px;padding:12px 28px;background:#3D5C42;color:white;border:none;
    border-radius:10px;font-size:14px;cursor:pointer;font-family:inherit;}
</style></head><body>
  <div class="logo">LifeFlow</div>
  <h2>You're offline 🌿</h2>
  <p>Your data is safely stored. Connect to sync with your account.</p>
  <button onclick="location.reload()">Try again</button>
</body></html>`;
}
