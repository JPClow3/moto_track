importScripts('https://storage.googleapis.com/workbox-cdn/releases/7.0.0/workbox-sw.js');

const BUILD_ID = new URL(self.location.href).searchParams.get("v") || "dev";
const OFFLINE_URL = "/offline/";

const PRECACHE = [
  "/manifest.webmanifest",
  OFFLINE_URL,
  "/static/css/tailwind.generated.css",
  "/static/css/app.css",
  "/static/js/theme.js",
  "/static/js/app.js",
  "/static/vendor/htmx/htmx.min.js",
  "/static/vendor/alpine/alpine.min.js",
  "/static/vendor/compressorjs/compressor.min.js",
  "/static/vendor/lucide/lucide.min.js",
  "/static/vendor/chart/chart.umd.js",
  "/static/brand/favicon-32x32.png",
  "/static/brand/web/android-chrome-192x192.png",
  "/static/brand/web/android-chrome-512x512.png",
];

// Use custom cache name prefix to avoid conflict and manage versions
workbox.core.setCacheNameDetails({
  prefix: 'moto-track',
  suffix: BUILD_ID,
});

workbox.precaching.precacheAndRoute(PRECACHE.map(url => ({ url, revision: BUILD_ID })));

// Background Sync for POST requests
const bgSyncPlugin = new workbox.backgroundSync.BackgroundSyncPlugin('moto-track-offline-queue', {
  maxRetentionTime: 24 * 60 * 2, // Retry for up to 48 Hours
});

workbox.routing.registerRoute(
  ({url, request}) => request.method === 'POST' && [
    "/fuel/quick-create/",
    "/maintenance/quick-create/",
    "/trabalho/turnos/novo/",
    "/quick-odometer-update/",
    "/documents/"
  ].some(path => url.pathname.startsWith(path)),
  new workbox.strategies.NetworkOnly({
    plugins: [
      bgSyncPlugin,
      {
        handlerDidError: async () => {
          return new Response(
            '<div class="alert-banner-main"><div class="alert-body"><span class="alert-icon"><i data-lucide="wifi-off" aria-hidden="true"></i></span><div><p class="font-semibold text-on-surface">Salvo offline.</p><p class="text-sm text-warning">Será sincronizado assim que a conexão voltar.</p></div></div></div>',
            { headers: { "Content-Type": "text/html" } }
          );
        }
      }
    ]
  }),
  'POST'
);

// Cache first strategy for static assets not precached
workbox.routing.registerRoute(
  ({url}) => url.pathname.startsWith('/static/'),
  new workbox.strategies.CacheFirst()
);

// Network first for navigation requests
workbox.routing.registerRoute(
  ({request}) => request.mode === 'navigate',
  new workbox.strategies.NetworkFirst({
    plugins: [
      {
        handlerDidError: async () => {
          return await caches.match(workbox.precaching.getCacheKeyForURL(OFFLINE_URL)) || new Response("Offline", { status: 503 });
        },
      },
    ],
  })
);

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
