export function GET() {
  const script = `
const CACHE = 'moto-track-offline-v1';
const OFFLINE_URL = '/offline';
const FUEL_SYNC_TAG = 'moto-track-fuel-sync';
const FUEL_DB = 'moto-track-offline';
const FUEL_STORE = 'fuel-submissions';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then(async (cache) => {
      await cache.addAll([OFFLINE_URL, '/manifest.webmanifest']);
      await self.skipWaiting();
    }),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))),
    ).then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    fetch(request)
      .then((response) => {
        if (url.pathname === OFFLINE_URL || url.pathname === '/manifest.webmanifest') {
          const copy = response.clone();
          void caches.open(CACHE).then((cache) => cache.put(request, copy));
        }
        return response;
      })
      .catch(async () => {
        const cached = await caches.match(request);
        if (cached) return cached;
        if (request.mode === 'navigate') {
          const offline = await caches.match(OFFLINE_URL);
          if (offline) return offline;
        }
        return Response.error();
      }),
  );
});

self.addEventListener('push', (event) => {
  let payload = { title: 'Moto Track', body: 'Você tem um lembrete.', url: '/reminders' };
  try {
    if (event.data) payload = { ...payload, ...event.data.json() };
  } catch {
    /* keep defaults */
  }
  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      data: { url: payload.url || '/reminders' },
      icon: '/brand/favicon-32x32.png',
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = event.notification.data?.url || '/reminders';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ('focus' in client) {
          void client.navigate(target);
          return client.focus();
        }
      }
      return self.clients.openWindow(target);
    }),
  );
});

function openFuelDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(FUEL_DB, 1);
    request.onupgradeneeded = () =>
      request.result.createObjectStore(FUEL_STORE, { keyPath: 'id' });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function readFuelQueue(db) {
  return new Promise((resolve, reject) => {
    const request = db.transaction(FUEL_STORE, 'readonly').objectStore(FUEL_STORE).getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

async function removeFuelItem(db, id) {
  return new Promise((resolve, reject) => {
    const request = db.transaction(FUEL_STORE, 'readwrite').objectStore(FUEL_STORE).delete(id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

async function syncFuelQueue() {
  const db = await openFuelDb();
  try {
    const items = await readFuelQueue(db);
    for (const item of items) {
      const body = new FormData();
      for (const [key, value] of Object.entries(item.values || {})) {
        body.set(key, String(value));
      }
      const response = await fetch('/fuel?/createRecord', {
        method: 'POST',
        body,
        credentials: 'include',
        headers: { accept: 'application/json' },
      });
      if (!response.ok) throw new Error('fuel sync failed');
      await removeFuelItem(db, item.id);
    }
  } finally {
    db.close();
  }
}

self.addEventListener('sync', (event) => {
  if (event.tag === FUEL_SYNC_TAG) {
    event.waitUntil(syncFuelQueue());
  }
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SYNC_FUEL_QUEUE') {
    event.waitUntil(syncFuelQueue());
  }
});
`;

  return new Response(script, {
    headers: {
      "content-type": "application/javascript; charset=utf-8",
      "cache-control": "no-cache",
    },
  });
}
