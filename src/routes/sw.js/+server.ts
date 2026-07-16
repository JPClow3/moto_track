export function GET() {
  return new Response(
    `self.addEventListener('install', event => { event.waitUntil(self.skipWaiting()); });
self.addEventListener('activate', event => { event.waitUntil(self.clients.claim()); });`,
    {
      headers: {
        "content-type": "application/javascript; charset=utf-8",
        "cache-control": "no-cache",
      },
    },
  );
}
