import { OFFLINE_CACHE, OFFLINE_LOCALE_KEY } from "$lib/utils/offline-cache";

export function GET() {
  const script = `
const CACHE = '${OFFLINE_CACHE}';
const FALLBACKS = { 'pt-BR': '/offline-pt-BR.html', en: '/offline-en.html' };
const LOCALE_KEY = '${OFFLINE_LOCALE_KEY}';
const PUBLIC_ASSETS = [...Object.values(FALLBACKS), '/offline-drafts.js', '/offline.css', '/manifest.webmanifest'];
const FUEL_SYNC_TAG = 'moto-track-fuel-sync';
const FUEL_DB = 'moto-track-offline';
const FUEL_STORE = 'fuel-submissions';
let fuelSync;

function headerLocale(header) {
  const ranked = String(header || '').split(',').map((part) => {
    const [tag, ...params] = part.trim().split(';');
    const q = params.map((p) => p.trim()).find((p) => p.startsWith('q='));
    const quality = q === undefined ? 1 : Number(q.slice(2));
    return { tag: tag.toLowerCase().split('-')[0], quality };
  }).filter(({ quality }) => Number.isFinite(quality) && quality > 0 && quality <= 1)
    .sort((a, b) => b.quality - a.quality);
  for (const { tag } of ranked) {
    if (tag === 'en') return 'en';
    if (tag === 'pt') return 'pt-BR';
  }
  return 'pt-BR';
}

async function preferredLocale(request) {
  const cache = await caches.open(CACHE);
  const saved = await cache.match(LOCALE_KEY);
  const locale = saved && await saved.text();
  if (locale === 'pt-BR' || locale === 'en') return locale;
  return headerLocale(request?.headers.get('accept-language') || self.navigator?.languages?.join(','));
}

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then(async (cache) => {
    // Standalone public documents contain no SSR payload or account data.
    await cache.addAll(PUBLIC_ASSETS);
    await self.skipWaiting();
  }));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(
    keys.filter((key) => key.startsWith('moto-track-offline-') && key !== CACHE)
      .map((key) => caches.delete(key)),
  )).then(() => self.clients.claim()));
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  event.respondWith(fetch(request).then((response) => {
    if (PUBLIC_ASSETS.includes(url.pathname) && response.ok && !response.redirected) {
      const copy = response.clone();
      event.waitUntil(caches.open(CACHE).then((cache) => cache.put(url.pathname, copy)));
    }
    return response;
  }).catch(async () => {
    const cache = await caches.open(CACHE);
    if (PUBLIC_ASSETS.includes(url.pathname)) {
      const cached = await cache.match(url.pathname);
      if (cached) return cached;
    }
    if (request.mode === 'navigate') {
      const offline = await cache.match(FALLBACKS[await preferredLocale(request)]);
      if (offline) return offline;
    }
    return Response.error();
  }));
});

self.addEventListener('push', (event) => {
  event.waitUntil((async () => {
    const locale = await preferredLocale();
    let payload = { title: 'Moto Track', body: locale === 'en' ? 'You have a reminder.' : 'Você tem um lembrete.', url: '/reminders' };
    try { if (event.data) payload = { ...payload, ...event.data.json() }; } catch { /* keep defaults */ }
    await self.registration.showNotification(payload.title, {
      body: payload.body,
      data: { url: payload.url || '/reminders' },
      icon: '/brand/favicon-32x32.png',
    });
  })());
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = event.notification.data?.url || '/reminders';
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
    for (const client of clients) {
      if ('focus' in client) { void client.navigate(target); return client.focus(); }
    }
    return self.clients.openWindow(target);
  }));
});

function openFuelDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(FUEL_DB, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(FUEL_STORE, { keyPath: 'id' });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function readFuelQueue(db) {
  return new Promise((resolve, reject) => {
    const request = db.transaction(FUEL_STORE, 'readonly').objectStore(FUEL_STORE).getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

function removeFuelItem(db, id) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(FUEL_STORE, 'readwrite');
    transaction.objectStore(FUEL_STORE).delete(id);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error || new Error('fuel queue removal aborted'));
  });
}

async function fuelStatus(db, item, status) {
  await new Promise((resolve, reject) => {
    const transaction = db.transaction(FUEL_STORE, 'readwrite');
    const store = transaction.objectStore(FUEL_STORE);
    const request = store.get(item.id);
    request.onsuccess = () => {
      if (request.result) store.put({ ...request.result, status, lastAttemptAt: new Date().toISOString() });
    };
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
  await notifyFuel(item.id, status);
}

async function notifyFuel(id, status) {
  const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  for (const client of clients) client.postMessage({ type: 'FUEL_SYNC_STATUS', id, status });
}

async function confirmedFuelResponse(response, id) {
  if (!response.ok || response.status !== 200 || response.redirected ||
      !response.headers.get('content-type')?.toLowerCase().includes('application/json')) return false;
  try {
    const action = await response.json();
    if (action.type !== 'success' || action.status !== 200 || typeof action.data !== 'string') return false;
    // SvelteKit action data is devalue JSON. Read only our primitive references;
    // never evaluate serialized code or accept a generic successful response.
    const values = JSON.parse(action.data);
    const object = Array.isArray(values) && values[0];
    return object && typeof object === 'object' && !Array.isArray(object) &&
      Number.isInteger(object.ok) && object.ok >= 1 && values[object.ok] === true &&
      Number.isInteger(object.offlineSubmissionId) && object.offlineSubmissionId >= 1 &&
      values[object.offlineSubmissionId] === id;
  } catch { return false; }
}

async function replayFuelQueue() {
  const db = await openFuelDb();
  try {
    const items = await readFuelQueue(db);
    if (!items.length) return;
    let currentOwner;
    try {
      const response = await fetch('/api/pwa/status', { credentials: 'include', cache: 'no-store', redirect: 'error', headers: { accept: 'application/json' } });
      if (!response.ok || response.redirected || !response.headers.get('content-type')?.includes('application/json')) throw new Error('fuel session not confirmed');
      const session = await response.json();
      currentOwner = session.authenticated === true && typeof session.userId === 'string' ? session.userId : null;
    } catch (cause) {
      for (const item of items) await fuelStatus(db, item, 'network');
      throw cause;
    }
    let unconfirmed;
    for (const item of items) {
      // Legacy entries lack an owner binding. Retain them for manual recovery.
      let blocked = !item.ownerId ? 'unknown-owner' : !currentOwner ? 'authentication' : item.ownerId !== currentOwner ? 'other-owner' : null;
      if (!blocked && Object.entries(item.values || {}).some(([key, value]) => (key === 'receipt_file' || key === 'receipt_file_key') && value)) blocked = 'file-missing';
      if (blocked) { await fuelStatus(db, item, blocked); unconfirmed = blocked; continue; }
      const body = new FormData();
      for (const [key, value] of Object.entries(item.values || {})) body.set(key, String(value));
      body.set('offline_submission_id', item.id);
      body.set('offline_owner_id', item.ownerId);
      let response;
      try {
        response = await fetch('/fuel?/createRecord', {
          method: 'POST', body, credentials: 'include', redirect: 'error',
          headers: { accept: 'application/json', 'x-sveltekit-action': 'true' },
        });
      } catch (cause) { await fuelStatus(db, item, 'network'); throw cause; }
      if (!await confirmedFuelResponse(response.clone(), String(item.id).toLowerCase())) {
        let actionStatus = response.status;
        try { const action = await response.json(); if (action.type === 'failure') actionStatus = action.status; } catch { /* retain draft */ }
        const status = actionStatus === 409 ? 'conflict' : actionStatus === 401 ? 'authentication' : 'invalid';
        await fuelStatus(db, item, status);
        unconfirmed = 'fuel sync not confirmed';
        continue;
      }
      await removeFuelItem(db, item.id);
      await notifyFuel(item.id, 'sent');
    }
    if (unconfirmed) throw new Error(unconfirmed);
  } finally { db.close(); }
}

function syncFuelQueue() {
  // A message and background sync may arrive together. Share one replay.
  if (!fuelSync) fuelSync = replayFuelQueue().finally(() => { fuelSync = undefined; });
  return fuelSync;
}

self.addEventListener('sync', (event) => {
  if (event.tag === FUEL_SYNC_TAG) event.waitUntil(syncFuelQueue());
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SYNC_FUEL_QUEUE') event.waitUntil(syncFuelQueue());
  if (event.data?.type === 'SET_LOCALE' && (event.data.locale === 'pt-BR' || event.data.locale === 'en')) {
    event.waitUntil(caches.open(CACHE).then((cache) => cache.put(LOCALE_KEY, new Response(event.data.locale))));
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
