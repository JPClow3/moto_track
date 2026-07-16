import { describe, expect, it } from "vitest";
import { calculateOwnershipCost } from "../../src/lib/server/domain/ownership-cost";

describe("total ownership cost", () => {
  it("sums purchase and operating costs, then derives cost per km", () => {
    expect(
      calculateOwnershipCost({
        purchaseCents: 3000000,
        fuelCents: 100000,
        maintenanceCents: 50000,
        tireCents: 80000,
        feeCents: 20000,
        currentKm: 25000,
      }),
    ).toEqual({ totalCents: 3250000, costPerKmCents: 130 });
  });

  it("includes a configured depreciation allowance", () => {
    expect(
      calculateOwnershipCost({
        purchaseCents: 0,
        fuelCents: 0,
        maintenanceCents: 0,
        tireCents: 0,
        feeCents: 0,
        depreciationCents: 15000,
        currentKm: 1000,
      }),
    ).toEqual({ totalCents: 15000, costPerKmCents: 15 });
  });
});
