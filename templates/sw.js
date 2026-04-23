/* App-shell service worker with offline queue and push notifications. */

const CACHE_NAME = "moto-track-shell-{{ build_id|escapejs }}";
const OFFLINE_URL = "/offline/";
const DB_NAME = "moto-track-offline-db";
const STORE_NAME = "offline-requests";

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
      await Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)));
      await self.clients.claim();
    })()
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;

  if (req.method === "POST" && (req.url.includes("/quick-create/") || req.url.includes("/fuel/"))) {
    event.respondWith(queuePostWhenOffline(req));
    return;
  }

  if (req.method !== "GET") return;

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

async function queuePostWhenOffline(req) {
  try {
    return await fetch(req.clone());
  } catch {
    const formData = await req.clone().formData();
    const body = new URLSearchParams(formData).toString();
    const headers = {};
    req.headers.forEach((value, key) => {
      headers[key] = value;
    });
    headers["Content-Type"] = "application/x-www-form-urlencoded";
    await saveRequest(req.url, req.method, headers, body);

    if ("sync" in self.registration) {
      try {
        await self.registration.sync.register("sync-offline-requests");
      } catch (err) {
        console.warn("Sync registration failed:", err);
      }
    }

    return new Response(
      '<div class="p-4 bg-warning text-surface-highest rounded-lg shadow-ambient font-extrabold flex items-center gap-2"><i data-lucide="wifi-off"></i> Salvo offline. Sera sincronizado assim que a conexao voltar.</div>',
      { headers: { "Content-Type": "text/html" } }
    );
  }
}

function initDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
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

async function saveRequest(url, method, headers, body) {
  const db = await initDB();
  const tx = db.transaction(STORE_NAME, "readwrite");
  tx.objectStore(STORE_NAME).add({ url, method, headers, body, timestamp: Date.now() });
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = (event) => reject(event.target.error);
  });
}

async function getRequests() {
  const db = await initDB();
  const tx = db.transaction(STORE_NAME, "readonly");
  const request = tx.objectStore(STORE_NAME).getAll();
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = (event) => reject(event.target.error);
  });
}

async function deleteRequest(id) {
  const db = await initDB();
  const tx = db.transaction(STORE_NAME, "readwrite");
  tx.objectStore(STORE_NAME).delete(id);
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = (event) => reject(event.target.error);
  });
}

async function syncRequests() {
  const requests = await getRequests();
  for (const queued of requests) {
    try {
      const response = await fetch(queued.url, {
        method: queued.method,
        headers: queued.headers,
        body: queued.body,
      });
      if (response.ok) {
        await deleteRequest(queued.id);
      } else {
        console.warn("Sync server error for request", queued.id, response.status);
      }
    } catch (err) {
      console.error("Sync network error for request", queued.id, err);
    }
  }
}

self.addEventListener("sync", (event) => {
  if (event.tag === "sync-offline-requests") {
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
    body: data.body || "Voce tem uma nova notificacao.",
    icon: "/static/icons/icon-192x192.png",
    badge: "/static/icons/icon-72x72.png",
    vibrate: [100, 50, 100],
    data: {
      url: data.url || "/",
    },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(clients.openWindow(event.notification.data.url));
});
