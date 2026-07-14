import { describe, expect, it } from "vitest";
import { recomputeOdometer } from "../../src/lib/server/domain/odometer";

describe("recomputeOdometer", () => {
  it("uses the max value across overrides and history", () => {
    expect(
      recomputeOdometer({
        overrideKm: 1200,
        fuel: [{ odometer_km: 1800 }],
        maintenance: [{ odometer_km: 1600 }],
        tires: [{ installed_odometer_km: 2100 }],
        work: [{ odometer_end_km: 2500 }],
      }),
    ).toBe(2500);
  });
});
