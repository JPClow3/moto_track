/** Shared by the service worker script and pages that write to its cache. */
export const OFFLINE_CACHE = "moto-track-offline-v2";
export const OFFLINE_LOCALE_KEY = "/__moto-track-offline-locale__";

/**
 * Store the explicit language for the standalone offline fallback. Pages write
 * it directly because a worker that is still installing cannot receive the
 * message yet; the `SET_LOCALE` message remains for the active worker.
 */
export async function saveOfflineLocale(locale: string) {
  if (typeof caches === "undefined") return;
  const cache = await caches.open(OFFLINE_CACHE);
  await cache.put(OFFLINE_LOCALE_KEY, new Response(locale));
}
