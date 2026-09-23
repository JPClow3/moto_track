import { afterEach, describe, expect, it, vi } from "vitest";
import { DELETE } from "../../src/routes/api/push/subscribe/+server";
import {
  disablePushNotifications,
  pushNotificationsEnabled,
} from "../../src/lib/utils/push";
import { pushEndpointHash } from "$server/domain/push-crypto";

const endpoint = "https://fcm.googleapis.com/fcm/send/device-token";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("push unsubscribe lifecycle", () => {
  it("deletes only the authenticated owner's current endpoint hash", async () => {
    const queries: Array<{ sql: string; values: unknown[] }> = [];
    const db = async (strings: TemplateStringsArray, ...values: unknown[]) => {
      queries.push({
        sql: strings.join("?").replaceAll(/\s+/g, " ").trim(),
        values,
      });
      return [];
    };

    const response = await DELETE({
      request: new Request("https://moto-track.net/api/push/subscribe", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ endpoint }),
      }),
      locals: { user: { id: "owner-1" }, db },
    } as never);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "ok" });
    expect(queries).toEqual([
      {
        sql: expect.stringContaining("delete from push_subscriptions"),
        values: ["owner-1", await pushEndpointHash(endpoint)],
      },
    ]);
    expect(queries[0].sql).toContain("where owner_id = ?");
    expect(queries[0].sql).toContain("and endpoint_hash = ?");
  });

  it("rejects unauthenticated deletion before touching storage", async () => {
    const db = vi.fn();
    await expect(
      DELETE({
        request: new Request("https://moto-track.net/api/push/subscribe", {
          method: "DELETE",
          body: JSON.stringify({ endpoint }),
        }),
        locals: { user: null, db },
      } as never),
    ).rejects.toMatchObject({ status: 401 });
    expect(db).not.toHaveBeenCalled();
  });

  it("removes the server record before unsubscribing in the browser", async () => {
    const unsubscribe = vi.fn().mockResolvedValue(true);
    const subscription = { endpoint, unsubscribe };
    const getSubscription = vi.fn().mockResolvedValue(subscription);
    vi.stubGlobal("window", { PushManager: class {} });
    vi.stubGlobal("navigator", {
      serviceWorker: {
        getRegistration: vi
          .fn()
          .mockResolvedValue({ pushManager: { getSubscription } }),
        ready: Promise.resolve({ pushManager: { getSubscription } }),
      },
    });
    const fetch = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetch);

    expect(await pushNotificationsEnabled()).toBe(true);
    await disablePushNotifications();

    expect(fetch).toHaveBeenCalledWith("/api/push/subscribe", {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ endpoint }),
    });
    expect(fetch.mock.invocationCallOrder[0]).toBeLessThan(
      unsubscribe.mock.invocationCallOrder[0],
    );
  });

  it("settles disabled without waiting for an unready service worker", async () => {
    vi.stubGlobal("window", { PushManager: class {} });
    vi.stubGlobal("navigator", {
      serviceWorker: {
        getRegistration: vi.fn().mockResolvedValue(undefined),
        ready: new Promise(() => undefined),
      },
    });

    await expect(pushNotificationsEnabled()).resolves.toBe(false);
  });

  it("keeps the browser subscription for a retry when server deletion fails", async () => {
    const unsubscribe = vi.fn();
    vi.stubGlobal("window", { PushManager: class {} });
    vi.stubGlobal("navigator", {
      serviceWorker: {
        ready: Promise.resolve({
          pushManager: {
            getSubscription: vi.fn().mockResolvedValue({
              endpoint,
              unsubscribe,
            }),
          },
        }),
      },
    });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));

    await expect(disablePushNotifications()).rejects.toThrow(
      "Não foi possível desativar",
    );
    expect(unsubscribe).not.toHaveBeenCalled();
  });
});
