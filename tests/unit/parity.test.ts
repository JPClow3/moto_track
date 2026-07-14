import { describe, expect, it } from "vitest";
import {
  archiveMotorcycle,
  buildTimeline,
  calculateWorkProfitability,
  normalizeTheme,
  restoreMotorcycle,
} from "$server/domain/parity";

describe("legacy parity domain helpers", () => {
  it("archives and restores a motorcycle without deleting its history", () => {
    expect(archiveMotorcycle("2026-07-14T12:00:00.000Z")).toEqual({
      is_active: false,
      deleted_at: "2026-07-14T12:00:00.000Z",
    });
    expect(restoreMotorcycle()).toEqual({ is_active: true, deleted_at: null });
  });

  it("accepts only persisted theme preferences", () => {
    expect(normalizeTheme("dark")).toBe("dark");
    expect(normalizeTheme("neon")).toBeNull();
  });

  it("filters and sorts a cross-domain report timeline", () => {
    const events = buildTimeline(
      [
        { source: "fuel", date: "2026-07-01", label: "Fuel", amountCents: 1000 },
        { source: "maintenance", date: "2026-07-10", label: "Oil", amountCents: 2000 },
      ],
      { source: "maintenance", start: "2026-07-05" },
    );
    expect(events).toEqual([
      { source: "maintenance", date: "2026-07-10", label: "Oil", amountCents: 2000 },
    ]);
  });

  it("calculates professional work cost and profitability", () => {
    expect(
      calculateWorkProfitability({
        distanceKm: 50,
        grossIncomeCents: 20000,
        tipsCents: 1000,
        fuelSpentCents: 4000,
        fixedDailyCostCents: 2000,
        maintenanceReservePerKmMillicents: 10000,
        depreciationPerKmMillicents: 5000,
      }),
    ).toEqual({ revenueCents: 21000, costCents: 6750, profitCents: 14250 });
  });
});
