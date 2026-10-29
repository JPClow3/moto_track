import { readFileSync } from "node:fs";
import { createContext, runInContext } from "node:vm";
import { stringify } from "devalue";
import { describe, expect, it, vi } from "vitest";
import { GET } from "../../src/routes/sw.js/+server";

const id = "f03ec98b-6c67-45f9-8fbb-e95857c3d01c";
const ownerId = "3c3278f5-2954-40a3-8a70-58ad56f53dce";
const item = {
  id,
  ownerId,
  values: {
    date: "2026-10-23",
    liters: "10",
    total_price: "60",
    odometer_km: "1000",
  },
};
const acknowledgement = (ackId = id) =>
  new Response(
    JSON.stringify({
      type: "success",
      status: 200,
      data: stringify({ ok: true, offlineSubmissionId: ackId }),
    }),
    { headers: { "content-type": "application/json" } },
  );

async function worker(
  entries: Record<string, unknown>[] = [structuredClone(item)],
) {
  const listeners = new Map<string, (event: Record<string, unknown>) => void>();
  const stores = new Map<string, Map<string, Response>>();
  const fetch = vi.fn().mockRejectedValue(new Error("offline"));
  const sessionFetch = vi
    .fn()
    .mockImplementation(async () =>
      Response.json({ authenticated: true, userId: ownerId }),
    );
  const deleted: string[] = [];
  const db = {
    close: vi.fn(),
    transaction: (_name: string, mode: string) => {
      const transaction = {
        oncomplete: undefined as undefined | (() => void),
        objectStore: () => ({
          get: (value: string) => {
            const request = {
              result: entries.find((entry) => entry.id === value),
              onsuccess: undefined as undefined | (() => void),
            };
            queueMicrotask(() => {
              request.onsuccess?.();
              queueMicrotask(() => transaction.oncomplete?.());
            });
            return request;
          },
          put: (value: Record<string, unknown>) => {
            const index = entries.findIndex((entry) => entry.id === value.id);
            if (index >= 0) entries[index] = value;
            else entries.push(value);
            queueMicrotask(() => transaction.oncomplete?.());
          },
          getAll: () => {
            const request = {
              result: entries,
              onsuccess: undefined as undefined | (() => void),
            };
            queueMicrotask(() => request.onsuccess?.());
            return request;
          },
          delete: (value: string) => {
            queueMicrotask(() => {
              entries.splice(
                entries.findIndex((entry) => entry.id === value),
                1,
              );
              deleted.push(value);
              transaction.oncomplete?.();
            });
          },
        }),
      };
      expect(["readonly", "readwrite"]).toContain(mode);
      return transaction;
    },
  };
  const caches = {
    keys: async () => [...stores.keys()],
    delete: vi.fn(async (name: string) => stores.delete(name)),
    open: async (name: string) => {
      const store = stores.get(name) ?? new Map<string, Response>();
      stores.set(name, store);
      return {
        match: async (key: string) => store.get(key)?.clone(),
        put: async (key: string, response: Response) => {
          store.set(key, response.clone());
        },
        addAll: async (keys: string[]) => {
          for (const key of keys) store.set(key, new Response(key));
        },
      };
    },
  };
  const context = createContext({
    URL,
    Response,
    FormData,
    fetch: (url: string, ...args: unknown[]) =>
      url === "/api/pwa/status"
        ? sessionFetch(url, ...args)
        : fetch(url, ...args),
    caches,
    queueMicrotask,
    indexedDB: {
      open: () => {
        const request = {
          result: db,
          onsuccess: undefined as undefined | (() => void),
        };
        queueMicrotask(() => request.onsuccess?.());
        return request;
      },
    },
    self: {
      location: { origin: "https://app.example" },
      navigator: { languages: ["en-US"] },
      addEventListener: (
        name: string,
        handler: (event: Record<string, unknown>) => void,
      ) => listeners.set(name, handler),
      skipWaiting: async () => {},
      clients: { claim: async () => {}, matchAll: async () => [] },
      registration: { showNotification: vi.fn() },
    },
  });
  runInContext(await GET().text(), context);
  return {
    context,
    caches,
    stores,
    fetch,
    sessionFetch,
    entries,
    deleted,
    listeners,
    sync: () => runInContext("syncFuelQueue()", context) as Promise<void>,
  };
}

describe("offline fuel acknowledgement", () => {
  it.each([
    [
      "authentication HTML",
      () =>
        new Response("<html>Sign in</html>", {
          headers: { "content-type": "text/html" },
        }),
    ],
    ["unconfirmed JSON", () => Response.json({ ok: true })],
    [
      "action failure",
      () =>
        Response.json({
          type: "failure",
          status: 400,
          data: stringify({ ok: true, offlineSubmissionId: id }),
        }),
    ],
    ["different acknowledgement", () => acknowledgement(crypto.randomUUID())],
    [
      "malformed action",
      () => Response.json({ type: "success", status: 200, data: "not JSON" }),
    ],
    [
      "redirect",
      () => {
        const response = acknowledgement();
        Object.defineProperty(response, "redirected", { value: true });
        // A real fetch response retains its internal redirect flag when cloned.
        const originalClone = response.clone.bind(response);
        response.clone = () => {
          const copy = originalClone();
          Object.defineProperty(copy, "redirected", { value: true });
          return copy;
        };
        return response;
      },
    ],
    ["server failure", () => new Response("failure", { status: 503 })],
  ] as const)("retains the queued record after %s", async (_name, response) => {
    const sw = await worker();
    sw.fetch.mockResolvedValueOnce(response());
    await expect(sw.sync()).rejects.toThrow("not confirmed");
    expect(sw.entries).toHaveLength(1);
    expect(sw.deleted).toEqual([]);
  });

  it("retries the same persisted identifier after a lost response and only removes an acknowledged commit", async () => {
    const sw = await worker();
    sw.fetch
      .mockRejectedValueOnce(new Error("response lost after commit"))
      .mockResolvedValueOnce(acknowledgement());
    await expect(sw.sync()).rejects.toThrow("response lost");
    expect(sw.entries).toHaveLength(1);
    await sw.sync();
    expect(sw.deleted).toEqual([id]);
    for (const [, options] of sw.fetch.mock.calls) {
      expect(options.redirect).toBe("error");
      expect(options.body.get("offline_submission_id")).toBe(id);
      expect(options.body.get("offline_owner_id")).toBe(ownerId);
    }
  });

  it("shares concurrent sync attempts and preserves legacy items without an owner binding", async () => {
    const sw = await worker();
    sw.fetch.mockResolvedValue(acknowledgement());
    await Promise.all([sw.sync(), sw.sync()]);
    expect(sw.fetch).toHaveBeenCalledTimes(1);
    const legacy = await worker([{ id, values: item.values }]);
    await expect(legacy.sync()).rejects.toThrow("unknown-owner");
    expect(legacy.fetch).not.toHaveBeenCalled();
    expect(legacy.entries).toHaveLength(1);
  });

  it("never POSTs another account's or unauthenticated drafts and retains visible failure status", async () => {
    const foreign = await worker([
      { ...structuredClone(item), ownerId: crypto.randomUUID() },
    ]);
    await expect(foreign.sync()).rejects.toThrow("other-owner");
    expect(foreign.fetch).not.toHaveBeenCalled();
    expect(foreign.entries[0].status).toBe("other-owner");
    const expired = await worker();
    expired.sessionFetch.mockResolvedValueOnce(
      Response.json({ authenticated: false, userId: null }),
    );
    await expect(expired.sync()).rejects.toThrow("authentication");
    expect(expired.fetch).not.toHaveBeenCalled();
    expect(expired.entries[0].status).toBe("authentication");
  });

  it("does not replay a draft that references a missing file", async () => {
    const sw = await worker([
      {
        ...structuredClone(item),
        values: { ...item.values, receipt_file: "missing-photo.jpg" },
      },
    ]);
    await expect(sw.sync()).rejects.toThrow("file-missing");
    expect(sw.fetch).not.toHaveBeenCalled();
    expect(sw.entries[0].status).toBe("file-missing");
  });
});

describe("public offline locale boundary", () => {
  it("uses explicit language preference before browser language and never caches SSR account pages", async () => {
    const sw = await worker([]);
    const cache = await sw.caches.open("moto-track-offline-v3");
    await cache.put(
      "/offline-en.html",
      new Response("English public fallback"),
    );
    await cache.put(
      "/offline-pt-BR.html",
      new Response("Portuguese public fallback"),
    );
    let pending: Promise<void> | undefined;
    sw.listeners.get("message")!({
      data: { type: "SET_LOCALE", locale: "pt-BR" },
      waitUntil: (promise: Promise<void>) => {
        pending = promise;
      },
    });
    await pending;
    let result: Promise<Response> | undefined;
    const request = {
      method: "GET",
      url: "https://app.example/dashboard",
      mode: "navigate",
      headers: new Headers({ "accept-language": "en-US" }),
    };
    sw.listeners.get("fetch")!({
      request,
      respondWith: (promise: Promise<Response>) => {
        result = promise;
      },
    });
    expect(await (await result!).text()).toBe("Portuguese public fallback");
    sw.fetch.mockResolvedValueOnce(new Response("private serialized user"));
    sw.listeners.get("fetch")!({
      request: { ...request, url: "https://app.example/offline" },
      respondWith: (promise: Promise<Response>) => {
        result = promise;
      },
    });
    await result;
    expect(await cache.match("/offline")).toBeUndefined();
  });

  it("clears the obsolete SSR cache without deleting caches from other applications", async () => {
    const sw = await worker([]);
    await sw.caches.open("moto-track-offline-v1");
    await sw.caches.open("unrelated-cache");
    let pending: Promise<void> | undefined;
    sw.listeners.get("activate")!({
      waitUntil: (promise: Promise<void>) => {
        pending = promise;
      },
    });
    await pending;
    expect(sw.stores.has("moto-track-offline-v1")).toBe(false);
    expect(sw.stores.has("unrelated-cache")).toBe(true);
  });

  it.each(["pt-BR", "en"])(
    "ships a standalone %s fallback with only the reviewed local recovery script and no serialized account data",
    (locale) => {
      const html = readFileSync(`static/offline-${locale}.html`, "utf8");
      expect(html).toContain(`<html lang="${locale}">`);
      expect(html).not.toMatch(/__data|neon_auth|owner_id|email|sveltekit/i);
      expect(html.match(/<script\b/g)).toHaveLength(1);
      expect(html).toContain('src="/offline-drafts.js"');
      expect(html).toContain("connect-src 'none'");
      expect(html).toContain('href=""');
    },
  );

  it("keeps cold-offline recovery local and renders text without HTML injection", () => {
    const script = readFileSync("static/offline-drafts.js", "utf8");
    expect(script).not.toMatch(
      /\bfetch\s*\(|XMLHttpRequest|innerHTML|insertAdjacentHTML/,
    );
    expect(script).toContain("textContent");
    expect(script).toContain('"moto-track-offline-fuel-v1"');
  });
});
