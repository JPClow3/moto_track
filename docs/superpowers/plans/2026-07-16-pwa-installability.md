# PWA Installability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Moto Track satisfy the browser requirements for installation as a standalone PWA without adding offline data caching yet.

**Architecture:** The root Svelte layout owns service-worker registration because it is the only client surface shared by every route. The `/sw.js` endpoint owns lifecycle behavior and claims clients immediately; it deliberately does not cache authenticated data. Playwright verifies the browser-observable contract rather than implementation details.

**Tech Stack:** SvelteKit, TypeScript, Cloudflare adapter, native Service Worker API, Playwright.

## Global Constraints

- Register only `/sw.js` and keep its scope at `/`.
- Do not cache authenticated HTML, API responses, or uploaded files in this installability task.
- Preserve the existing web manifest endpoint and standalone display mode.
- Use browser tests for registration and manifest delivery.

---

### Task 1: Register the service worker safely from the shared client layout

**Files:**

- Modify: `src/routes/+layout.svelte`
- Test: `tests/e2e/pwa-installability.spec.ts`

**Interfaces:**

- Consumes: `navigator.serviceWorker.register('/sw.js', { scope: '/' })`
- Produces: one active registration with scope ending in `/` after the public home page loads.

- [x] **Step 1: Write the failing browser test**

```ts
import { expect, test } from "@playwright/test";

test("registers the Moto Track service worker", async ({ page }) => {
  await page.goto("/");

  const registration = await page.evaluate(async () => {
    if (!("serviceWorker" in navigator)) return null;
    const worker = await navigator.serviceWorker.ready;
    return { scope: worker.scope, active: Boolean(worker.active) };
  });

  expect(registration).not.toBeNull();
  expect(registration).toMatchObject({ active: true });
  expect(registration?.scope).toBe("http://127.0.0.1:5187/");
});
```

- [x] **Step 2: Run the new test to verify it fails**

Run: `npx playwright test tests/e2e/pwa-installability.spec.ts`

Expected: FAIL because no client code registers `/sw.js`.

- [x] **Step 3: Add the minimal registration effect**

```svelte
<script lang="ts">
  import "../app.css";
  import { onMount } from "svelte";
  import type { Snippet } from "svelte";

  let { children }: { children: Snippet } = $props();

  onMount(() => {
    if (!("serviceWorker" in navigator)) return;
    void navigator.serviceWorker.register("/sw.js", { scope: "/" });
  });
</script>
```

- [x] **Step 4: Run the new test to verify it passes**

Run: `npx playwright test tests/e2e/pwa-installability.spec.ts`

Expected: PASS with one active registration scoped to `/`.

### Task 2: Make the worker lifecycle deterministic and verify the web manifest

**Files:**

- Modify: `src/routes/sw.js/+server.ts`
- Test: `tests/e2e/pwa-installability.spec.ts`

**Interfaces:**

- Consumes: `/sw.js` and `/manifest.webmanifest`
- Produces: an activated worker that takes control of pages and a manifest declaring standalone display with `/dashboard` as the start URL.

- [x] **Step 1: Extend the browser test**

```ts
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
```

- [x] **Step 2: Verify the worker activation assertion**

Run: `npx playwright test tests/e2e/pwa-installability.spec.ts`

Expected: the registration test still fails until the worker calls `clients.claim()` during activation.

- [x] **Step 3: Replace the inert worker with lifecycle code**

```ts
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
```

- [x] **Step 4: Run focused browser verification**

Run: `npx playwright test tests/e2e/pwa-installability.spec.ts`

Expected: both tests PASS.

### Task 3: Run the Track 1a verification gate

**Files:**

- Verify: `src/routes/+layout.svelte`
- Verify: `src/routes/sw.js/+server.ts`
- Verify: `tests/e2e/pwa-installability.spec.ts`

- [x] **Step 1: Type-check the client and route changes**

Run: `npm.cmd run check`

Expected: exit 0 with no new diagnostics in the changed PWA files.

- [x] **Step 2: Run the complete browser suite**

Run: `npm.cmd run test:e2e`

Expected: all browser tests pass, including the new PWA tests.

- [x] **Step 3: Build the Cloudflare output**

Run: `npm.cmd run build`

Expected: exit 0 and the Cloudflare adapter completes successfully.

- [x] **Step 4: Check the final patch for whitespace errors**

Run: `git diff --check`

Expected: exit 0 with no output.
