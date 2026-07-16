import { expect, test } from "@playwright/test";

test("registers the Moto Track service worker", async ({ page }) => {
  await page.goto("/");

  await expect
    .poll(() =>
      page.evaluate(async () => {
        if (!("serviceWorker" in navigator)) return null;
        return navigator.serviceWorker.getRegistration("/");
      }),
    )
    .not.toBeNull();

  await expect
    .poll(() =>
      page.evaluate(async () => {
        const worker = await navigator.serviceWorker.getRegistration("/");
        return Boolean(worker?.active);
      }),
    )
    .toBe(true);

  const registration = await page.evaluate(async () => {
    const worker = await navigator.serviceWorker.getRegistration("/");
    return worker?.scope;
  });

  expect(registration).toBe("http://127.0.0.1:5187/");
});

test("serves a standalone Moto Track manifest", async ({ request }) => {
  const response = await request.get("/manifest.webmanifest");
  const manifest = await response.json();

  expect(response.headers()["content-type"]).toContain("application/json");
  expect(manifest).toMatchObject({
    name: "Moto Track",
    start_url: "/dashboard",
    display: "standalone",
  });
});

test("pre-caches an offline fallback for a previously unavailable connection", async ({ page }) => {
  await page.goto("/");

  await expect
    .poll(() =>
      page.evaluate(async () => {
        const keys = await caches.keys();
        const cache = await caches.open("moto-track-offline-v1");
        const fallback = await cache.match("/offline");
        return keys.includes("moto-track-offline-v1") && Boolean(fallback);
      }),
    )
    .toBe(true);
});
