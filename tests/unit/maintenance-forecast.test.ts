import { describe, expect, it } from "vitest";
import { forecastMaintenance } from "$server/domain/maintenance-forecast";

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
});
