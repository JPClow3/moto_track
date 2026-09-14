import { describe, expect, it } from "vitest";
import { detectFuelConsumptionAnomalies } from "$server/domain/fuel";

describe("detectFuelConsumptionAnomalies", () => {
  it("flags a full-tank interval that is materially below recent consumption", () => {
    const anomalies = detectFuelConsumptionAnomalies([
      {
        id: "a",
        motorcycle_id: "m1",
        date: "2026-01-01",
        odometer_km: 0,
        liters: 10,
        tank_full: true,
      },
      {
        id: "b",
        motorcycle_id: "m1",
        date: "2026-01-05",
        odometer_km: 200,
        liters: 10,
        tank_full: true,
      },
      {
        id: "c",
        motorcycle_id: "m1",
        date: "2026-01-10",
        odometer_km: 400,
        liters: 10,
        tank_full: true,
      },
      {
        id: "d",
        motorcycle_id: "m1",
        date: "2026-01-15",
        odometer_km: 500,
        liters: 10,
        tank_full: true,
      },
    ]);

    expect(anomalies.get("d")).toContain("Consumo abaixo");
  });

  it("does not mix records from different motorcycles", () => {
    const anomalies = detectFuelConsumptionAnomalies([
      {
        id: "a",
        motorcycle_id: "m1",
        date: "2026-01-01",
        odometer_km: 0,
        liters: 10,
        tank_full: true,
      },
      {
        id: "b",
        motorcycle_id: "m1",
        date: "2026-01-05",
        odometer_km: 200,
        liters: 10,
        tank_full: true,
      },
      {
        id: "c",
        motorcycle_id: "m1",
        date: "2026-01-10",
        odometer_km: 400,
        liters: 10,
        tank_full: true,
      },
      {
        id: "d",
        motorcycle_id: "m2",
        date: "2026-01-15",
        odometer_km: 10,
        liters: 20,
        tank_full: true,
      },
    ]);

    expect(anomalies.size).toBe(0);
  });

  it("accumulates intermediate partial fills between full tank fills", () => {
    const anomalies = detectFuelConsumptionAnomalies([
      {
        id: "a",
        motorcycle_id: "m1",
        date: "2026-01-01",
        odometer_km: 0,
        liters: 10,
        tank_full: true,
      },
      {
        id: "b",
        motorcycle_id: "m1",
        date: "2026-01-05",
        odometer_km: 200,
        liters: 10,
        tank_full: true,
      },
      {
        id: "c",
        motorcycle_id: "m1",
        date: "2026-01-10",
        odometer_km: 400,
        liters: 10,
        tank_full: true,
      },
      {
        id: "d_partial",
        motorcycle_id: "m1",
        date: "2026-01-12",
        odometer_km: 500,
        liters: 5,
        tank_full: false,
      },
      {
        id: "e",
        motorcycle_id: "m1",
        date: "2026-01-15",
        odometer_km: 600,
        liters: 5,
        tank_full: true,
      },
    ]);

    // Total km = 200, total liters = 5 + 5 = 10 L -> 20 km/L (matches recent baseline of 20 km/L)
    expect(anomalies.has("e")).toBe(false);
  });
});
