import { createHmac } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
vi.mock("$env/dynamic/private", () => ({ env: {} }));
vi.mock("$env/dynamic/public", () => ({ env: {} }));
import { constructDodoEvent } from "$server/domain/billing";
const key = Buffer.from("hermetic-webhook-signing-test-key");
const platform = {
  env: {
    DODO_PAYMENTS_API_KEY: "test_key",
    DODO_PAYMENTS_ENVIRONMENT: "test_mode",
    DODO_PAYMENTS_WEBHOOK_SECRET: `whsec_${key.toString("base64")}`,
  },
} as unknown as App.Platform;
const payload = JSON.stringify({
  business_id: "bus_test",
  type: "subscription.active",
  timestamp: "2026-09-29T12:00:00Z",
  data: { subscription_id: "sub_test" },
});
function headers(timestamp = Math.floor(Date.now() / 1000)) {
  const signature = createHmac("sha256", key)
    .update(`msg_test.${timestamp}.${payload}`)
    .digest("base64");
  return {
    "webhook-id": "msg_test",
    "webhook-timestamp": String(timestamp),
    "webhook-signature": `v1,${signature}`,
  };
}
describe("Dodo SDK Standard Webhooks verification", () => {
  it("accepts a real HMAC signature over the raw body and delivery headers", () => {
    expect(constructDodoEvent(payload, headers(), platform).type).toBe(
      "subscription.active",
    );
  });
  it("rejects changed raw payload, header identity and signatures", () => {
    expect(() =>
      constructDodoEvent(`${payload} `, headers(), platform),
    ).toThrow();
    expect(() =>
      constructDodoEvent(
        payload,
        { ...headers(), "webhook-id": "other_id" },
        platform,
      ),
    ).toThrow();
    expect(() =>
      constructDodoEvent(
        payload,
        { ...headers(), "webhook-signature": "v1,invalid" },
        platform,
      ),
    ).toThrow();
  });
  it("rejects old and future signed timestamps beyond the replay tolerance", () => {
    expect(() =>
      constructDodoEvent(
        payload,
        headers(Math.floor(Date.now() / 1000) - 600),
        platform,
      ),
    ).toThrow();
    expect(() =>
      constructDodoEvent(
        payload,
        headers(Math.floor(Date.now() / 1000) + 600),
        platform,
      ),
    ).toThrow();
  });
  it("requires a configured secret and explicit provider environment", () => {
    expect(() =>
      constructDodoEvent(payload, headers(), { env: {} } as App.Platform),
    ).toThrow("WEBHOOK_SECRET");
    expect(() =>
      constructDodoEvent(payload, headers(), {
        env: { ...platform.env, DODO_PAYMENTS_ENVIRONMENT: undefined },
      } as App.Platform),
    ).toThrow("ENVIRONMENT");
  });
});
