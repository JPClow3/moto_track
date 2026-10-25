import { describe, expect, it } from "vitest";
import { estimateTireLife } from "../../src/lib/server/domain/tire-life";

describe("tire-life estimate", () => {
  it("keeps the projected replacement fixed as the bike moves beyond the wear observation", () => {
    expect(
      estimateTireLife({
        installedKm: 10000,
        observedKm: 15000,
        currentKm: 20000,
        wearPercent: 25,
      }),
    ).toEqual({ projectedChangeKm: 30000, remainingKm: 10000 });
  });
  it("projects replacement from installed km, current km, and observed wear", () => {
    expect(
      estimateTireLife({
        installedKm: 10000,
        currentKm: 15000,
        wearPercent: 25,
      }),
    ).toEqual({
      projectedChangeKm: 30000,
      remainingKm: 15000,
    });
  });
  it("treats fully worn tires as due now", () => {
    expect(
      estimateTireLife({
        installedKm: 10000,
        currentKm: 15000,
        wearPercent: 100,
      }),
    ).toEqual({ projectedChangeKm: 15000, remainingKm: 0 });
  });
  it("withholds projections without traveled distance or with invalid mileage", () => {
    for (const [installedKm, currentKm] of [
      [10000, 10000],
      [10000, 9000],
      [-1, 10000],
      [0, Infinity],
    ]) {
      expect(
        estimateTireLife({ installedKm, currentKm, wearPercent: 25 }),
      ).toBeNull();
    }
  });

  it("does not invent an estimate without observed wear", () => {
    expect(
      estimateTireLife({
        installedKm: 10000,
        currentKm: 15000,
        wearPercent: 0,
      }),
    ).toBeNull();
  });
});
