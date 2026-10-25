import { describe, expect, it } from "vitest";
import {
  forecastMaintenance,
  estimateDailyDistance,
  validDate,
} from "$server/domain/maintenance-forecast";

describe("forecastMaintenance", () => {
  it("uses observed riding pace to estimate a due date", () => {
    expect(
      forecastMaintenance({
        lastService: { date: "2026-01-01", odometer_km: 1000 },
        intervalKm: 1000,
        intervalDays: null,
        currentKm: 1500,
        odometerSamples: [
          { date: "2026-01-01", odometer_km: 1000 },
          { date: "2026-01-11", odometer_km: 1500 },
        ],
        today: "2026-01-11",
      }),
    ).toMatchObject({ dueKm: 2000, dueDate: "2026-01-21", kmPerDay: 50 });
  });
  it("does not infer a riding pace from a rollback, one date, stale data or future readings", () => {
    const today = "2026-02-01";
    for (const samples of [
      [
        { date: "2026-01-01", odometer_km: 2000 },
        { date: "2026-01-20", odometer_km: 1000 },
      ],
      [
        { date: "2026-01-20", odometer_km: 1000 },
        { date: "2026-01-20", odometer_km: 1500 },
      ],
      [
        { date: "2025-11-01", odometer_km: 1000 },
        { date: "2025-12-01", odometer_km: 2000 },
      ],
      [
        { date: "2026-01-20", odometer_km: 1000 },
        { date: "2026-02-20", odometer_km: 2000 },
      ],
    ])
      expect(estimateDailyDistance(samples, today)).toBeNull();
  });
  it("honors an earlier calendar interval even without observed riding", () => {
    expect(
      forecastMaintenance({
        lastService: { date: new Date("2026-01-01"), odometer_km: 1000 },
        intervalKm: 1000,
        intervalDays: 15,
        currentKm: 1100,
        odometerSamples: [],
        today: "2026-01-11",
      }),
    ).toMatchObject({ dueDate: "2026-01-16", kmPerDay: null });
  });
  it("withholds dates when history is unconfirmed and rejects impossible dates", () => {
    expect(
      forecastMaintenance({
        lastService: null,
        intervalKm: 1000,
        intervalDays: 30,
        currentKm: 1000,
        odometerSamples: [],
        today: "2026-01-01",
      }),
    ).toBeNull();
    expect(validDate("2026-02-31")).toBeNull();
    expect(validDate(new Date("invalid"))).toBeNull();
  });
});
