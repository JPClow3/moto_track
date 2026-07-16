import { describe, expect, it } from "vitest";
import {
  activityCalendar,
  consumptionTrend,
  costBreakdown,
  spendByMonth,
} from "../../src/lib/server/domain/dashboard";

describe("consumptionTrend", () => {
  it("measures km/L between consecutive full tanks", () => {
    const points = consumptionTrend([
      { date: "2026-01-01", odometer_km: 1000, liters: 10, tank_full: true },
      { date: "2026-01-10", odometer_km: 1200, liters: 10, tank_full: true },
      { date: "2026-01-20", odometer_km: 1500, liters: 15, tank_full: true },
    ]);

    expect(points).toEqual([
      { date: "2026-01-10", kmPerLiter: 20 },
      { date: "2026-01-20", kmPerLiter: 20 },
    ]);
  });

  it("folds partial fills into the interval they belong to", () => {
    // 1000 -> 1300km on 10L (partial) + 10L (full) = 15 km/L, not 30.
    const points = consumptionTrend([
      { date: "2026-01-01", odometer_km: 1000, liters: 8, tank_full: true },
      { date: "2026-01-05", odometer_km: 1150, liters: 10, tank_full: false },
      { date: "2026-01-10", odometer_km: 1300, liters: 10, tank_full: true },
    ]);

    expect(points).toEqual([{ date: "2026-01-10", kmPerLiter: 15 }]);
  });

  it("needs two full tanks before it reports anything", () => {
    expect(
      consumptionTrend([
        { date: "2026-01-01", odometer_km: 1000, liters: 10, tank_full: true },
        { date: "2026-01-05", odometer_km: 1150, liters: 10, tank_full: false },
      ]),
    ).toEqual([]);
  });

  it("skips intervals that cannot be measured", () => {
    // A rolled-back odometer would otherwise produce a negative consumption.
    expect(
      consumptionTrend([
        { date: "2026-01-01", odometer_km: 1000, liters: 10, tank_full: true },
        { date: "2026-01-10", odometer_km: 900, liters: 10, tank_full: true },
      ]),
    ).toEqual([]);
  });

  it("keeps only the most recent readings", () => {
    const records = Array.from({ length: 20 }, (_, i) => ({
      date: `2026-01-${String(i + 1).padStart(2, "0")}`,
      odometer_km: 1000 + i * 200,
      liters: 10,
      tank_full: true,
    }));

    const points = consumptionTrend(records, 5);
    expect(points).toHaveLength(5);
    expect(points[points.length - 1].date).toBe("2026-01-20");
  });
});

describe("spendByMonth", () => {
  it("buckets spend into a trailing window including empty months", () => {
    const months = spendByMonth(
      [
        { date: "2026-07-04", amountCents: 5000 },
        { date: "2026-07-20", amountCents: 2500 },
        { date: "2026-05-11", amountCents: 1000 },
      ],
      { today: "2026-07-16", months: 3 },
    );

    expect(months).toEqual([
      { month: "2026-05", cents: 1000 },
      { month: "2026-06", cents: 0 },
      { month: "2026-07", cents: 7500 },
    ]);
  });

  it("ignores records outside the window", () => {
    const months = spendByMonth([{ date: "2020-01-01", amountCents: 9999 }], {
      today: "2026-07-16",
      months: 2,
    });

    expect(months.every((month) => month.cents === 0)).toBe(true);
  });

  it("does not let income-style negatives subtract from spend", () => {
    const months = spendByMonth([{ date: "2026-07-01", amountCents: -5000 }], {
      today: "2026-07-16",
      months: 1,
    });

    expect(months).toEqual([{ month: "2026-07", cents: 0 }]);
  });
});

describe("costBreakdown", () => {
  it("orders slices by size and drops empty categories", () => {
    expect(
      costBreakdown({ fuel: 1000, maintenance: 5000, tires: 0, fees: 200 }),
    ).toEqual([
      { key: "maintenance", label: "Manutenção", cents: 5000 },
      { key: "fuel", label: "Combustível", cents: 1000 },
      { key: "fees", label: "Taxas", cents: 200 },
    ]);
  });

  it("returns nothing when there is no spend", () => {
    expect(
      costBreakdown({ fuel: 0, maintenance: 0, tires: 0, fees: 0 }),
    ).toEqual([]);
  });
});

describe("activityCalendar", () => {
  it("emits whole weeks ending on the Sunday of the current week", () => {
    // 2026-07-16 is a Thursday, so the grid runs through Sunday 2026-07-19.
    const cells = activityCalendar([], { today: "2026-07-16", weeks: 2 });

    expect(cells).toHaveLength(14);
    expect(cells[0].date).toBe("2026-07-06");
    expect(cells[cells.length - 1].date).toBe("2026-07-19");
    expect(new Date(`${cells[0].date}T00:00:00.000Z`).getUTCDay()).toBe(1);
  });

  it("counts multiple records on the same day", () => {
    const cells = activityCalendar(
      ["2026-07-14", "2026-07-14", "2026-07-15"],
      { today: "2026-07-16", weeks: 2 },
    );

    expect(cells.find((cell) => cell.date === "2026-07-14")?.count).toBe(2);
    expect(cells.find((cell) => cell.date === "2026-07-15")?.count).toBe(1);
    expect(cells.find((cell) => cell.date === "2026-07-13")?.count).toBe(0);
  });

  it("accepts timestamps as well as plain dates", () => {
    const cells = activityCalendar(["2026-07-14T13:45:00.000Z"], {
      today: "2026-07-16",
      weeks: 2,
    });

    expect(cells.find((cell) => cell.date === "2026-07-14")?.count).toBe(1);
  });
});
