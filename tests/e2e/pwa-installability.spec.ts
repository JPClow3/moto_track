import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { seedLocalFuelDrafts } from "./helpers/offline-queue";

test("registers the Moto Track service worker", async ({ page }) => {
  await page.goto("/");

  await expect
    .poll(
      () =>
        page.evaluate(async () => {
          if (!("serviceWorker" in navigator)) return null;
          return navigator.serviceWorker.getRegistration("/");
        }),
      { timeout: 20_000 },
    )
    .not.toBeNull();

  await expect
    .poll(
      () =>
        page.evaluate(async () => {
          const worker = await navigator.serviceWorker.getRegistration("/");
          return Boolean(worker?.active);
        }),
      { timeout: 20_000 },
    )
    .toBe(true);

  const registration = await page.evaluate(async () => {
    const worker = await navigator.serviceWorker.getRegistration("/");
    return worker?.scope;
  });

  expect(registration).toBe(new URL("/", page.url()).href);
});

test("cold offline recovery exports and discards local drafts without account data or network submission", async ({
  page,
  context,
}) => {
  await page.goto("/precos");
  await expect(page.locator('html[data-app-ready="true"]')).toHaveCount(1);
  await page.locator("#locale-select").selectOption("en");
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.locator('html[data-app-ready="true"]')).toHaveCount(1);
  await expect
    .poll(
      () =>
        page.evaluate(async () => {
          const cache = await caches.open("moto-track-offline-v2");
          const locale = await cache.match("/__moto-track-offline-locale__");
          // An object, so a failure names the condition that never held.
          return {
            controlled: Boolean(navigator.serviceWorker.controller),
            locale: locale ? await locale.text() : null,
            drafts: Boolean(await cache.match("/offline-drafts.js")),
          };
        }),
      { timeout: 20_000 },
    )
    .toEqual({ controlled: true, locale: "en", drafts: true });
  const id = "f03ec98b-6c67-45f9-8fbb-e95857c3d01c";
  const note = '<img src=x onerror="window.unsafeDraft=true">';
  await seedLocalFuelDrafts(page, [
    {
      id,
      createdAt: "2026-10-23T12:00:00.000Z",
      values: {
        date: "2026-10-22",
        liters: "10",
        total_price: "60",
        odometer_km: "1000",
        notes: note,
      },
    },
  ]);
  await context.setOffline(true);
  try {
    await page.goto("/offline-recovery-acceptance");
    await expect(page.locator("#drafts-status")).toHaveText("1 local draft(s)");
    const event = page.waitForEvent("download");
    await page
      .getByRole("button", { name: "Export all local drafts", exact: true })
      .click();
    const exported = JSON.parse(
      await readFile((await (await event).path())!, "utf8"),
    );
    expect(exported.drafts[0]).toMatchObject({ id, values: { notes: note } });
    expect(exported.drafts[0].ownerId).toBeUndefined();
    await expect(page.locator("img")).toHaveCount(0);
    context.once("dialog", (dialog) => dialog.accept());
    await page
      .getByRole("button", { name: "Discard all local drafts", exact: true })
      .click();
    await expect(page.locator("#drafts-status")).toHaveText("0 local draft(s)");
  } finally {
    await context.setOffline(false);
  }
});

test("serves a standalone Moto Track manifest", async ({ request }) => {
  const response = await request.get("/manifest.webmanifest");
  const manifest = await response.json();

  expect(response.headers()["content-type"]).toContain("application/json");
  expect(manifest).toMatchObject({
    name: "Moto Track",
    start_url: "/dashboard",
    display: "standalone",
    icons: [
      {
        src: "/brand/web/android-chrome-192x192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/brand/web/android-chrome-512x512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  });
});

test("pre-caches an offline fallback for a previously unavailable connection", async ({
  page,
}) => {
  await page.goto("/");

  await expect
    .poll(
      () =>
        page.evaluate(async () => {
          const keys = await caches.keys();
          const cache = await caches.open("moto-track-offline-v2");
          const pt = await cache.match("/offline-pt-BR.html");
          const en = await cache.match("/offline-en.html");
          const ssr = await cache.match("/offline");
          return (
            keys.includes("moto-track-offline-v2") && Boolean(pt && en) && !ssr
          );
        }),
      { timeout: 20_000 },
    )
    .toBe(true);
});

test("uses the explicit English preference for a standalone offline fallback without account serialization", async ({
  page,
  context,
}) => {
  await page.goto("/precos");
  await expect(page.locator('html[data-app-ready="true"]')).toHaveCount(1);
  await page.locator("#locale-select").selectOption("en");
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect
    .poll(
      () =>
        page.evaluate(async () => {
          const cache = await caches.open("moto-track-offline-v2");
          const saved = await cache.match("/__moto-track-offline-locale__");
          return {
            controlled: Boolean(navigator.serviceWorker.controller),
            locale: saved ? await saved.text() : null,
          };
        }),
      { timeout: 20_000 },
    )
    .toEqual({ controlled: true, locale: "en" });
  await context.setOffline(true);
  try {
    await page.goto("/dashboard?offline-acceptance=1");
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(
      page.getByRole("heading", { name: "You're offline" }),
    ).toBeVisible();
    await expect(page.locator("script")).toHaveCount(1);
    await expect(page.locator("script")).toHaveAttribute(
      "src",
      "/offline-drafts.js",
    );
    expect(await page.content()).not.toMatch(
      /__data|neon_auth|owner_id|sveltekit/i,
    );
  } finally {
    await context.setOffline(false);
  }
});
