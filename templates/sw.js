/* Moto Track production PWA service worker. */

const CACHE_NAME = "moto-track-shell-{{ build_id|escapejs }}";
const OFFLINE_URL = "/offline/";
const DB_NAME = "moto-track-offline-db";
const STORE_NAME = "offline-requests";
const OFFLINE_QUEUE_SYNC = "moto-track-offline-queue";
const PWA_STATUS_URL = "/api/pwa/status/";

const PRECACHE = [
  "/manifest.webmanifest",
  OFFLINE_URL,
  "/static/css/tailwind.generated.css",
  "/static/css/app.css",
  "/static/js/theme.js",
  "/static/js/app.js",
  "/static/js/offline-queue.js",
  "/static/vendor/htmx/htmx.min.js",
  "/static/vendor/alpine/alpine.min.js",
  "/static/vendor/lucide/lucide.min.js",
  "/static/vendor/chart/chart.umd.js",
  "/static/brand/favicon-32x32.png",
  "/static/brand/web/android-chrome-192x192.png",
  "/static/brand/web/android-chrome-512x512.png",
];

const QUEUEABLE_PATHS = [
  "/fuel/quick-create/",
  "/maintenance/quick-create/",
  "/quick-odometer-update/",
  "/documents/",
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
      await Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)));
      await self.clients.claim();
    })()
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);

  if (req.method === "POST" && url.origin === self.location.origin && isQueueablePath(url.pathname)) {
    event.respondWith(queuePostWhenNetworkFails(req));
    return;
  }

  if (req.method !== "GET") return;

  if (req.mode === "navigate") {
    event.respondWith(networkFirstNavigation(req));
    return;
  }

  if (url.origin === self.location.origin && (url.pathname.startsWith("/static/") || url.pathname === "/manifest.webmanifest")) {
    event.respondWith(cacheFirst(req));
  }
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "sync-offline-queue") {
    event.waitUntil(syncRequests());
  }
});

self.addEventListener("sync", (event) => {
  if (event.tag === OFFLINE_QUEUE_SYNC) {
    event.waitUntil(syncRequests());
  }
});

self.addEventListener("push", (event) => {
  let data = {};
  if (event.data) {
    try {
      data = event.data.json();
    } catch {
      data = { body: event.data.text() };
    }
  }

  const title = data.title || "Moto Track";
  const options = {
    body: data.body || "Você tem uma nova notificação.",
    icon: "/static/brand/web/android-chrome-192x192.png",
    badge: "/static/brand/favicon-32x32.png",
    vibrate: [100, 50, 100],
    data: {
      url: data.url || "/dashboard/",
    },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(clients.openWindow(event.notification.data.url));
});

function isQueueablePath(pathname) {
  return QUEUEABLE_PATHS.includes(pathname);
}

async function networkFirstNavigation(req) {
  try {
    return await fetch(req);
  } catch {
    const cache = await caches.open(CACHE_NAME);
    return (await cache.match(OFFLINE_URL)) || new Response("Offline", { status: 503 });
  }
}

async function cacheFirst(req) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(req);
  if (cached) return cached;
  const res = await fetch(req);
  cache.put(req, res.clone());
  return res;
}

async function queuePostWhenNetworkFails(req) {
  try {
    return await fetch(req.clone());
  } catch {
    const queued = await requestToQueueRecord(req);
    await saveRequest(queued);
    await registerBackgroundSync();
    await broadcastQueueState();
    if (req.mode === "navigate") {
      return offlineNavigationFallback();
    }
    return offlineQueuedFragmentResponse();
  }
}

async function offlineNavigationFallback() {
  const cache = await caches.open(CACHE_NAME);
  return (await cache.match(OFFLINE_URL)) || new Response("Offline", { status: 503 });
}

function offlineQueuedFragmentResponse() {
  return new Response(
    '<div class="alert-banner-main"><div class="alert-body"><span class="alert-icon"><i data-lucide="wifi-off" aria-hidden="true"></i></span><div><p class="font-semibold text-on-surface">Salvo offline.</p><p class="text-sm text-warning">Será sincronizado assim que a conexão voltar.</p></div></div></div>',
    { headers: { "Content-Type": "text/html" } }
  );
}

async function requestToQueueRecord(req) {
  const formData = await req.clone().formData();
  const fields = [];
  const files = [];
  for (const [name, value] of formData.entries()) {
    if (value instanceof File) {
      files.push({ name, file: value, filename: value.name, type: value.type });
    } else {
      fields.push({ name, value: String(value) });
    }
  }
  const headers = {};
  req.headers.forEach((value, key) => {
    if (!["content-length", "content-type"].includes(key.toLowerCase())) {
      headers[key] = value;
    }
  });
  const csrfField = fields.find((field) => field.name === "csrfmiddlewaretoken");
  const submissionField = fields.find((field) => field.name === "client_submission_id");
  return {
    action: actionFromPath(new URL(req.url).pathname),
    url: req.url,
    method: req.method,
    headers,
    csrfToken: csrfField ? csrfField.value : headers["x-csrftoken"] || "",
    clientSubmissionId: submissionField ? submissionField.value : "",
    fields,
    files,
    status: "pending",
    retryCount: 0,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

function actionFromPath(pathname) {
  if (pathname.startsWith("/fuel/quick-create/")) return "fuel:quick_create";
  if (pathname.startsWith("/maintenance/quick-create/")) return "maintenance:quick_create";
  if (pathname.startsWith("/quick-odometer-update/")) return "quick_odometer_update";
  if (pathname.startsWith("/documents/")) return "documents:list";
  return "form_submit";
}

function initDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 2);
    request.onerror = (event) => reject(event.target.error);
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id", autoIncrement: true });
      }
    };
    request.onsuccess = (event) => resolve(event.target.result);
  });
}

async function saveRequest(record) {
  const db = await initDB();
  const tx = db.transaction(STORE_NAME, "readwrite");
  tx.objectStore(STORE_NAME).add(record);
  return txDone(tx);
}

async function updateRequest(record) {
  const db = await initDB();
  const tx = db.transaction(STORE_NAME, "readwrite");
  tx.objectStore(STORE_NAME).put({ ...record, updatedAt: Date.now() });
  return txDone(tx);
}

async function getRequests() {
  const db = await initDB();
  const tx = db.transaction(STORE_NAME, "readonly");
  const request = tx.objectStore(STORE_NAME).getAll();
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = (event) => reject(event.target.error);
  });
}

async function deleteRequest(id) {
  const db = await initDB();
  const tx = db.transaction(STORE_NAME, "readwrite");
  tx.objectStore(STORE_NAME).delete(id);
  return txDone(tx);
}

function txDone(tx) {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = (event) => reject(event.target.error);
  });
}

async function syncRequests() {
  const status = await fetchPwaStatus();
  if (!status.authenticated) {
    await markAll("login_required");
    await broadcastQueueState();
    return;
  }

  const requests = await getRequests();
  for (const queued of requests.filter((item) => ["pending", "syncing", "login_required"].includes(item.status))) {
    try {
      await updateRequest({ ...queued, status: "syncing", retryCount: queued.retryCount || 0 });
      const response = await fetch(queued.url, {
        method: queued.method,
        credentials: "same-origin",
        headers: {
          ...(queued.headers || {}),
          "X-CSRFToken": status.csrf_token,
        },
        body: buildFormData(queued, status.csrf_token),
      });
      if (response.ok && !response.url.includes("/accounts/login")) {
        await deleteRequest(queued.id);
      } else if ([400, 422].includes(response.status)) {
        await updateRequest({ ...queued, status: "needs_review", retryCount: (queued.retryCount || 0) + 1 });
      } else if ([401, 403].includes(response.status) || response.url.includes("/accounts/login")) {
        await updateRequest({ ...queued, status: "login_required", retryCount: (queued.retryCount || 0) + 1 });
      } else {
        await updateRequest({ ...queued, status: "pending", retryCount: (queued.retryCount || 0) + 1 });
      }
    } catch {
      await updateRequest({ ...queued, status: "pending", retryCount: (queued.retryCount || 0) + 1 });
    }
  }
  await broadcastQueueState();
}

async function fetchPwaStatus() {
  try {
    const response = await fetch(PWA_STATUS_URL, {
      credentials: "same-origin",
      headers: { Accept: "application/json" },
    });
    if (response.ok) return await response.json();
  } catch {
    // keep queued items pending when status cannot be checked
  }
  return { authenticated: true, csrf_token: "" };
}

function buildFormData(queued, csrfToken) {
  const formData = new FormData();
  for (const field of queued.fields || []) {
    formData.append(field.name, field.name === "csrfmiddlewaretoken" && csrfToken ? csrfToken : field.value);
  }
  for (const item of queued.files || []) {
    formData.append(item.name, item.file, item.filename || item.file.name);
  }
  return formData;
}

async function markAll(status) {
  const requests = await getRequests();
  await Promise.all(requests.map((request) => updateRequest({ ...request, status })));
}

async function registerBackgroundSync() {
  if ("sync" in self.registration) {
    try {
      await self.registration.sync.register(OFFLINE_QUEUE_SYNC);
    } catch {
      // foreground retry still handles browsers that reject registration
    }
  }
}

async function broadcastQueueState() {
  const requests = await getRequests();
  const pending = requests.filter((item) => ["pending", "syncing"].includes(item.status)).length;
  const failed = requests.filter((item) => ["needs_review", "login_required"].includes(item.status)).length;
  const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
  for (const client of windows) {
    client.postMessage({ type: "offline-pending-count", count: pending, failed, total: requests.length });
    client.postMessage({ type: "offline-queue-state", pending, failed, total: requests.length });
  }
}
