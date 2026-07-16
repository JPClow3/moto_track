import { describe, expect, it } from "vitest";
import { detectFuelConsumptionAnomalies } from "$server/domain/fuel";

describe("detectFuelConsumptionAnomalies", () => {
  it("flags a full-tank interval that is materially below recent consumption", () => {
    const anomalies = detectFuelConsumptionAnomalies([
      { id: "a", motorcycle_id: "m1", date: "2026-01-01", odometer_km: 0, liters: 10, tank_full: true },
      { id: "b", motorcycle_id: "m1", date: "2026-01-05", odometer_km: 200, liters: 10, tank_full: true },
      { id: "c", motorcycle_id: "m1", date: "2026-01-10", odometer_km: 400, liters: 10, tank_full: true },
      { id: "d", motorcycle_id: "m1", date: "2026-01-15", odometer_km: 500, liters: 10, tank_full: true },
    ]);

    expect(anomalies.get("d")).toContain("Consumo abaixo");
  });

  it("does not mix records from different motorcycles", () => {
    const anomalies = detectFuelConsumptionAnomalies([
      { id: "a", motorcycle_id: "m1", date: "2026-01-01", odometer_km: 0, liters: 10, tank_full: true },
      { id: "b", motorcycle_id: "m1", date: "2026-01-05", odometer_km: 200, liters: 10, tank_full: true },
      { id: "c", motorcycle_id: "m1", date: "2026-01-10", odometer_km: 400, liters: 10, tank_full: true },
      { id: "d", motorcycle_id: "m2", date: "2026-01-15", odometer_km: 10, liters: 20, tank_full: true },
    ]);

    expect(anomalies.size).toBe(0);
  });
});
