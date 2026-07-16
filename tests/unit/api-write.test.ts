import { describe, expect, it } from "vitest";
import { normalizeApiFeaturePayload } from "../../src/lib/server/domain/api-write";
import { getFeature } from "../../src/lib/server/domain/features";

describe("API write payloads", () => {
  it("adds ownership while discarding caller-controlled fields", () => {
    const result = normalizeApiFeaturePayload(getFeature("fuel"), {
      date: "2026-07-16",
      odometer_km: 12500,
      liters: 12.5,
      total_price_cents: 75,
      owner_id: "another-user",
    }, "owner-1");

    expect(result).toMatchObject({
      ok: true,
      payload: { owner_id: "owner-1", odometer_km: 12500, total_price_cents: 7500 },
    });
    if (result.ok) expect(result.payload).not.toHaveProperty("id");
  });
});
