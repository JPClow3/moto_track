import { describe, expect, it } from "vitest";
import {
  ownershipSummary,
  type OwnershipMotorcycle,
} from "$server/domain/ownership-report";

const bike: OwnershipMotorcycle = {
  id: "bike",
  name: "CG",
  current_odometer_km: 25000,
  purchase_odometer_km: 20000,
  purchase_price_cents: 1000000,
  purchase_date: "2026-01-01",
  fuel_cents: 50000,
  maintenance_cents: 10000,
  tire_cents: 20000,
  fee_cents: 10000,
};

describe("ownership report", () => {
  it("divides purchase and recorded running costs by distance since acquisition", () => {
    expect(ownershipSummary(bike)).toMatchObject({
      distanceKm: 5000,
      totalCents: 1090000,
      costPerKmCents: 218,
    });
  });
  it("withholds cost per km for unknown acquisition basis or no traveled distance", () => {
    expect(
      ownershipSummary({ ...bike, purchase_currency: "USD" }),
    ).toMatchObject({ ready: false, costPerKmCents: null });
    expect(
      ownershipSummary({ ...bike, purchase_odometer_km: null }),
    ).toMatchObject({ ready: false, costPerKmCents: null });
    expect(
      ownershipSummary({ ...bike, current_odometer_km: 20000 }).costPerKmCents,
    ).toBeNull();
    expect(
      ownershipSummary({ ...bike, current_odometer_km: 19000 }).costPerKmCents,
    ).toBeNull();
  });
});
