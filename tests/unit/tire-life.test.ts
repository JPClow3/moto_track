import { describe, expect, it } from "vitest";
import { estimateTireLife } from "../../src/lib/server/domain/tire-life";

describe("tire-life estimate", () => {
  it("projects replacement from installed km, current km, and observed wear", () => {
    expect(estimateTireLife({ installedKm: 10000, currentKm: 15000, wearPercent: 25 })).toEqual({
      projectedChangeKm: 30000,
      remainingKm: 15000,
    });
  });

  it("does not invent an estimate without observed wear", () => {
    expect(estimateTireLife({ installedKm: 10000, currentKm: 15000, wearPercent: 0 })).toBeNull();
  });
});
