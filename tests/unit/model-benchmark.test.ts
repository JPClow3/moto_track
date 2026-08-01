import { describe, expect, it } from "vitest";
import {
  BENCHMARK_MIN_SAMPLE_SIZE,
  comparableBenchmarkMetrics,
  compareBenchmarkMetric,
  hasCompleteModelIdentity,
  hasComparableBenchmarkMetric,
  modelBenchmarkKey,
  normalizeBenchmarkMetric,
  benchmarkPosition,
} from "../../src/lib/server/domain/model-benchmark";

describe("modelBenchmarkKey", () => {
  it("normalizes accents, punctuation and casing into a stable key", () => {
    expect(modelBenchmarkKey(" Honda ", "CG 160 Titan", 2024)).toBe(
      "honda:cg-160-titan:2024",
    );
  });

  it("rejects an incomplete identity instead of creating a cohort", () => {
    expect(modelBenchmarkKey("Honda", "", 2024)).toBe("");
    expect(modelBenchmarkKey("🏍️", "CG 160", 2024)).toBe("");
    expect(hasCompleteModelIdentity("Honda", "CG 160", 1900)).toBe(false);
    expect(hasCompleteModelIdentity("Honda", "CG 160", 2024)).toBe(true);
  });
});

describe("benchmarkPosition", () => {
  it("holds the k-anonymity floor and inclusive 10% comparison band", () => {
    expect(benchmarkPosition(12, 10, BENCHMARK_MIN_SAMPLE_SIZE - 1)).toBe(
      "sem comparação",
    );
    expect(benchmarkPosition(11, 10)).toBe("na média");
    expect(benchmarkPosition(11.01, 10)).toBe("acima da média");
    expect(benchmarkPosition(8.99, 10)).toBe("abaixo da média");
  });

  it("does not claim a comparison for invalid averages", () => {
    expect(benchmarkPosition(10, 0)).toBe("sem comparação");
    expect(benchmarkPosition(Number.NaN, 10)).toBe("sem comparação");
  });
});

describe("comparableBenchmarkMetrics", () => {
  it("normalizes maintenance to cost per 1,000 recorded kilometres", () => {
    const metrics = comparableBenchmarkMetrics(
      [
        {
          date: "2026-01-01",
          odometer_km: 10_000,
          liters: 10,
          tank_full: true,
        },
        {
          date: "2026-02-01",
          odometer_km: 11_000,
          liters: 10,
          tank_full: true,
        },
      ],
      [{ date: "2026-01-15", odometer_km: 10_500, cost_cents: 5_000 }],
    );

    expect(metrics.consumptionKmL).toBe(100);
    expect(metrics.maintenanceCentsPer1000Km).toBe(5_000);
    expect(metrics.distanceKm).toBe(1_000);
    expect(hasComparableBenchmarkMetric(metrics)).toBe(true);
  });

  it("withholds consumption after an odometer rollback", () => {
    const metrics = comparableBenchmarkMetrics(
      [
        {
          date: "2026-01-01",
          odometer_km: 10_000,
          liters: 10,
          tank_full: true,
        },
        {
          date: "2026-02-01",
          odometer_km: 9_900,
          liters: 10,
          tank_full: true,
        },
      ],
      [],
    );

    expect(metrics.consumptionKmL).toBeNull();
    expect(metrics.consumptionIntervals).toBe(0);
  });

  it("requires enough odometer history to normalize maintenance", () => {
    const metrics = comparableBenchmarkMetrics(
      [
        {
          date: "2026-01-01",
          odometer_km: 10_000,
          liters: 10,
          tank_full: true,
        },
      ],
      [{ date: "2026-01-02", odometer_km: 10_000, cost_cents: 1000 }],
    );

    expect(metrics.maintenanceCentsPer1000Km).toBeNull();
    expect(hasComparableBenchmarkMetric(metrics)).toBe(false);
  });
});

describe("benchmark metric safety", () => {
  it("rejects out-of-range values rather than clipping poisoning attempts", () => {
    expect(normalizeBenchmarkMetric(null, { min: 0, max: 100 })).toBeNull();
    expect(normalizeBenchmarkMetric("  ", { min: 0, max: 100 })).toBeNull();
    expect(normalizeBenchmarkMetric(0, { min: 1, max: 100 })).toBeNull();
    expect(normalizeBenchmarkMetric(101, { min: 1, max: 100 })).toBeNull();
    expect(normalizeBenchmarkMetric(12.345, { min: 1, max: 100 }, 2)).toBe(
      12.35,
    );
  });

  it("withholds relative positions until a cohort reaches five accounts", () => {
    const comparison = compareBenchmarkMetric(12, 10, 4);
    expect(comparison.available).toBe(false);
    expect(comparison.position).toBe("sem comparação");
    expect(comparison.average).toBeNull();
  });
});
