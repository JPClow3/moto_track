/* Minimal app-shell service worker (cache-first for navigation fallback). */

const CACHE_NAME = ["moto-track-shell", self.registration.scope, self.location.href].join("-");
const OFFLINE_URL = "/offline/";

const PRECACHE = [
  OFFLINE_URL,
  "/static/css/tailwind.generated.css",
  "/static/css/app.css",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      await cache.addAll(PRECACHE);
      await self.skipWaiting();
    })()
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)));
      await self.clients.claim();
    })()
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;

  // Handle specific POST requests for offline sync
  if (req.method === "POST" && (req.url.includes("/quick-create/") || req.url.includes("/fuel/"))) {
    event.respondWith(
      (async () => {
        try {
          return await fetch(req.clone());
        } catch (e) {
          // Store offline
          const formData = await req.clone().formData();
          const body = new URLSearchParams(formData).toString();
          const headers = {};
          req.headers.forEach((value, key) => headers[key] = value);
          headers['Content-Type'] = 'application/x-www-form-urlencoded';
          await saveRequest(req.url, req.method, headers, body);
          
          if ('sync' in self.registration) {
             try {
                 await self.registration.sync.register('sync-offline-requests');
             } catch (err) {
                 console.log("Sync registration failed:", err);
             }
          }
          
          // Return a mock response indicating it was saved offline (HTMX friendly)
          return new Response(
            '<div class="p-4 bg-warning text-surface-highest rounded-lg shadow-ambient font-extrabold flex items-center gap-2"><i data-lucide="wifi-off"></i> Salvo offline. Será sincronizado assim que a conexão voltar.</div>',
            { headers: { 'Content-Type': 'text/html' } }
          );
        }
      })()
    );
    return;
  }

  // Only handle GET.
  if (req.method !== "GET") return;

  // Navigation requests: try network first, fallback to offline page.
  if (req.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          return await fetch(req);
        } catch {
          const cache = await caches.open(CACHE_NAME);
          return (await cache.match(OFFLINE_URL)) || new Response("Offline", { status: 503 });
        }
      })()
    );
    return;
  }

  // Static assets: cache-first.
  if (req.url.includes("/static/")) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE_NAME);
        const cached = await cache.match(req);
        if (cached) return cached;
        const res = await fetch(req);
        cache.put(req, res.clone());
        return res;
      })()
    );
  }
});

// IndexedDB logic for Background Sync
const DB_NAME = 'moto-track-offline-db';
const STORE_NAME = 'offline-requests';

function initDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, 1);
        request.onerror = (e) => reject(e.target.error);
        request.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
            }
        };
        request.onsuccess = (e) => resolve(e.target.result);
    });
}

async function saveRequest(url, method, headers, body) {
    const db = await initDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.add({ url, method, headers, body, timestamp: Date.now() });
    return new Promise((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = (e) => reject(e.target.error);
    });
}

async function getRequests() {
    const db = await initDB();
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.getAll();
    return new Promise((resolve, reject) => {
        request.onsuccess = () => resolve(request.result);
        request.onerror = (e) => reject(e.target.error);
    });
}

async function deleteRequest(id) {
    const db = await initDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.delete(id);
    return new Promise((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = (e) => reject(e.target.error);
    });
}

async function syncRequests() {
    const requests = await getRequests();
    for (const req of requests) {
        try {
            await fetch(req.url, {
                method: req.method,
                headers: req.headers,
                body: req.body,
            });
            await deleteRequest(req.id);
        } catch (e) {
            console.error('Sync failed for request', req.id, e);
        }
    }
}

self.addEventListener('sync', (event) => {
    if (event.tag === 'sync-offline-requests') {
        event.waitUntil(syncRequests());
    }
});

// WebPush Notifications logic
self.addEventListener('push', function(event) {
  let data = {};
  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      data = { body: event.data.text() };
    }
  }

  const title = data.title || 'Moto Track';
  const options = {
    body: data.body || 'Você tem uma nova notificação.',
    icon: '/static/icons/icon-192x192.png',
    badge: '/static/icons/icon-72x72.png',
    vibrate: [100, 50, 100],
    data: {
      url: data.url || '/'
    }
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  event.waitUntil(
    clients.openWindow(event.notification.data.url)
  );
});

