import { describe, expect, it } from "vitest";
import {
  completeTimelineBound,
  feeEntry,
  filterTimeline,
  fuelEntry,
  groupTimelineByMonth,
  insuranceEntry,
  maintenanceEntry,
  mergeTimeline,
  nextBefore,
  parseCalendarDay,
  parseTimelineFilter,
  tireEntry,
  timelineWindow,
  type TimelineEntry,
} from "../../src/lib/server/domain/timeline";

const fuel = (id: string, date: string, odometer: number, cents = 5000) =>
  fuelEntry({
    id,
    date,
    odometer_km: odometer,
    liters: "10.5",
    total_price_cents: cents,
    currency: "BRL",
    station_name: "Posto",
    motorcycle_id: "bike-1",
    motorcycle_name: "CB 500",
  });

const service = (id: string, date: string, odometer: number, cents = 30000) =>
  maintenanceEntry({
    id,
    date,
    odometer_km: odometer,
    maintenance_type: "Troca de óleo",
    cost_cents: cents,
    currency: "BRL",
    workshop: "Oficina",
    motorcycle_id: "bike-1",
  });

const tire = (id: string, date: string, odometer: number, cents = 80000) =>
  tireEntry({
    id,
    installed_at: date,
    installed_odometer_km: odometer,
    position: "traseiro",
    brand_model: "Pirelli Diablo",
    cost_cents: cents,
    currency: "BRL",
    motorcycle_id: "bike-1",
  });

const fee = (id: string, date: string, cents = 15000, currency = "BRL") =>
  feeEntry({
    id,
    date,
    fee_type: "IPVA",
    year: 2026,
    amount_cents: cents,
    currency,
    motorcycle_id: null,
  });

const ids = (entries: TimelineEntry[]) => entries.map((entry) => entry.id);

describe("row mappers", () => {
  it("normalises each source into a timeline entry with its page link", () => {
    expect(fuel("f1", "2026-10-02", 12000)).toMatchObject({
      id: "fuel:f1",
      kind: "fuel",
      date: "2026-10-02",
      odometerKm: 12000,
      amountCents: 5000,
      liters: 10.5,
      detail: "Posto",
      motorcycleName: "CB 500",
      href: "/fuel",
    });
    expect(service("m1", "2026-10-02", 12000)).toMatchObject({
      kind: "maintenance",
      label: "Troca de óleo",
      detail: "Oficina",
      href: "/maintenance",
    });
    expect(tire("t1", "2026-10-02", 12000)).toMatchObject({
      kind: "tires",
      position: "traseiro",
      label: "Pirelli Diablo",
      href: "/tires",
    });
    expect(fee("a1", "2026-10-02")).toMatchObject({
      kind: "expenses",
      subkind: "fee",
      odometerKm: null,
      motorcycleId: null,
      href: "/expenses",
    });
    expect(
      insuranceEntry({
        id: "i1",
        coverage_start: new Date("2026-10-02T00:00:00Z"),
        premium_cents: "120000",
        currency: "brl",
        provider: "Porto",
      }),
    ).toMatchObject({
      id: "insurance:i1",
      kind: "expenses",
      subkind: "insurance",
      date: "2026-10-02",
      amountCents: 120000,
      currency: "BRL",
      detail: "Porto",
    });
  });

  it("falls back to the description when a service has no type", () => {
    expect(
      maintenanceEntry({
        id: "m2",
        date: "2026-01-01",
        odometer_km: 1,
        maintenance_type: "",
        description: "Revisão geral",
      }).label,
    ).toBe("Revisão geral");
  });
});

describe("mergeTimeline", () => {
  it("merges every source newest first", () => {
    const merged = mergeTimeline(
      [fuel("f1", "2026-09-01", 10000), fuel("f2", "2026-10-15", 11000)],
      [service("m1", "2026-10-01", 10500)],
      [tire("t1", "2026-08-20", 9800)],
      [fee("a1", "2026-10-20")],
    );
    expect(ids(merged)).toEqual([
      "fee:a1",
      "fuel:f2",
      "maintenance:m1",
      "fuel:f1",
      "tires:t1",
    ]);
  });

  it("breaks same-day ties by odometer, highest first", () => {
    const merged = mergeTimeline(
      [fuel("f1", "2026-10-10", 12000)],
      [service("m1", "2026-10-10", 12050)],
      [tire("t1", "2026-10-10", 11990)],
    );
    expect(ids(merged)).toEqual(["maintenance:m1", "fuel:f1", "tires:t1"]);
  });

  it("puts same-day entries without a reading after those with one", () => {
    const merged = mergeTimeline(
      [fee("a1", "2026-10-10")],
      [fuel("f1", "2026-10-10", 12000)],
    );
    expect(ids(merged)).toEqual(["fuel:f1", "fee:a1"]);
  });

  it("is stable when date and odometer are equal", () => {
    const first = mergeTimeline(
      [service("m1", "2026-10-10", 12000)],
      [fuel("f1", "2026-10-10", 12000)],
    );
    const second = mergeTimeline(
      [fuel("f1", "2026-10-10", 12000)],
      [service("m1", "2026-10-10", 12000)],
    );
    expect(ids(first)).toEqual(["fuel:f1", "maintenance:m1"]);
    expect(ids(second)).toEqual(ids(first));
  });
});

describe("filterTimeline", () => {
  const entries = mergeTimeline(
    [fuel("f1", "2026-10-01", 1000)],
    [service("m1", "2026-10-02", 1100)],
    [tire("t1", "2026-10-03", 1200)],
    [fee("a1", "2026-10-04")],
  );

  it("keeps everything for 'all'", () => {
    expect(filterTimeline(entries, "all")).toHaveLength(4);
  });

  it("keeps only the chosen kind", () => {
    expect(ids(filterTimeline(entries, "tires"))).toEqual(["tires:t1"]);
    expect(ids(filterTimeline(entries, "expenses"))).toEqual(["fee:a1"]);
  });

  it("parses unknown ?type= values as 'all'", () => {
    expect(parseTimelineFilter("fuel")).toBe("fuel");
    expect(parseTimelineFilter("expenses")).toBe("expenses");
    expect(parseTimelineFilter("history")).toBe("all");
    expect(parseTimelineFilter(null)).toBe("all");
  });
});

describe("groupTimelineByMonth", () => {
  it("groups by month in order and totals each month", () => {
    const months = groupTimelineByMonth(
      mergeTimeline(
        [fuel("f1", "2026-10-15", 1500, 5000), fuel("f2", "2026-09-30", 1400)],
        [service("m1", "2026-10-01", 1450, 30000)],
        [fee("a1", "2026-08-05", 15000)],
      ),
    );
    expect(months.map((month) => month.key)).toEqual([
      "2026-10",
      "2026-09",
      "2026-08",
    ]);
    expect(ids(months[0].entries)).toEqual(["fuel:f1", "maintenance:m1"]);
    expect(months[0].totalCents).toBe(35000);
    expect(months[1].totalCents).toBe(5000);
    expect(months[2].totalCents).toBe(15000);
  });

  it("leaves other currencies out of the month total", () => {
    const [month] = groupTimelineByMonth([
      fee("a1", "2026-10-02", 10000),
      fee("a2", "2026-10-01", 99999, "USD"),
    ]);
    expect(month.entries).toHaveLength(2);
    expect(month.totalCents).toBe(10000);
  });

  it("returns no months for an empty stream", () => {
    expect(groupTimelineByMonth([])).toEqual([]);
  });
});

describe("paging window", () => {
  it("covers the last twelve calendar months by default, open-ended", () => {
    expect(timelineWindow(null, "2026-10-28")).toEqual({
      start: "2025-11-01",
      end: null,
    });
  });

  it("ends before ?before= and spans twelve months back from it", () => {
    expect(timelineWindow("2025-11-01", "2026-10-28")).toEqual({
      start: "2024-11-01",
      end: "2025-11-01",
    });
    expect(timelineWindow("2024-03-16", "2026-10-28")).toEqual({
      start: "2023-04-01",
      end: "2024-03-16",
    });
  });

  it("points 'see more' at the day after the newest older record", () => {
    expect(nextBefore("2024-03-15")).toBe("2024-03-16");
    expect(nextBefore("2024-12-31")).toBe("2025-01-01");
    expect(nextBefore(null)).toBeNull();
  });

  it("accepts only real calendar days for ?before=", () => {
    expect(parseCalendarDay("2026-02-28")).toBe("2026-02-28");
    expect(parseCalendarDay("2026-02-30")).toBeNull();
    expect(parseCalendarDay("2026-2-1")).toBeNull();
    expect(parseCalendarDay("'; drop table x")).toBeNull();
    expect(parseCalendarDay(undefined)).toBeNull();
  });
});

describe("truncated sources", () => {
  it("leaves the window alone when no source reached its cap", () => {
    expect(
      completeTimelineBound(
        [[fuel("f1", "2026-10-20", 900)], [service("s1", "2026-01-02", 100)]],
        3,
      ),
    ).toBeNull();
  });

  it("ends the page at the first complete month after a capped source's oldest day", () => {
    const capped = [
      fuel("f1", "2026-10-20", 900),
      fuel("f2", "2026-09-15", 800),
      fuel("f3", "2026-08-30", 700),
    ];
    const bound = completeTimelineBound(
      [capped, [service("s1", "2026-08-10", 600)]],
      3,
    );
    // August may be missing capped rows, so it moves whole to the next page.
    expect(bound).toBe("2026-09-01");
    expect(nextBefore("2026-08-31")).toBe(bound);
  });

  it("falls back to a day cut when the newest month alone exceeds the cap", () => {
    const capped = [
      fuel("f1", "2026-10-20", 900),
      fuel("f2", "2026-10-15", 800),
      fuel("f3", "2026-10-10", 700),
    ];
    expect(completeTimelineBound([capped], 3)).toBe("2026-10-11");
  });

  it("keeps a page whose capped rows share one day instead of repeating it", () => {
    const capped = [
      fuel("f1", "2026-10-10", 900),
      fuel("f2", "2026-10-10", 800),
      fuel("f3", "2026-10-10", 700),
    ];
    expect(completeTimelineBound([capped], 3)).toBeNull();
  });
});
