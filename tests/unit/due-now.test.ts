import { describe, expect, it } from "vitest";
import {
  buildDueNow,
  mostUrgentFor,
  rankAttention,
  type AttentionReminder,
  type DueNowItem,
} from "$server/domain/due-now";

type PlanRow = Record<string, unknown>;

function plan(overrides: PlanRow = {}): PlanRow {
  return {
    id: "plan-1",
    motorcycle_id: "bike-1",
    motorcycle_name: "Moto 1",
    maintenance_type: "Óleo do motor",
    interval_km: 6000,
    last_done_km: null,
    initial_history_status: "unknown",
    estimated_cost_cents: 11000,
    official_url: "",
    document_version: "",
    page_reference: "",
    ...overrides,
  };
}

describe("due-now attention list", () => {
  it("surfaces a date-overdue service while its mileage is still safe", () => {
    expect(
      buildDueNow({
        rows: [
          plan({
            initial_history_status: "confirmed_done",
            last_done_km: 1000,
            last_done_date: "2026-01-01",
            interval_days: 180,
          }),
        ],
        odometerByMotorcycle: new Map([["bike-1", 1500]]),
        today: "2026-10-23",
      }),
    ).toMatchObject([{ urgency: "overdue", confidence: "confirmed" }]);
  });
  it("leaves out services that are still within their interval", () => {
    const items = buildDueNow({
      rows: [
        plan({
          initial_history_status: "confirmed_done",
          last_done_km: 40_000,
        }),
      ],
      odometerByMotorcycle: new Map([["bike-1", 41_000]]),
    });
    expect(items).toHaveLength(0);
  });

  it("separates a measured overdue from one the rider only reported", () => {
    const items = buildDueNow({
      rows: [
        plan({
          id: "measured",
          initial_history_status: "confirmed_done",
          last_done_km: 40_000,
        }),
        plan({ id: "reported", initial_history_status: "not_done" }),
        plan({ id: "unsure", initial_history_status: "unknown" }),
      ],
      odometerByMotorcycle: new Map([["bike-1", 50_000]]),
    });

    const byId = new Map(items.map((item) => [item.id, item]));
    expect(byId.get("measured")).toMatchObject({
      urgency: "overdue",
      confidence: "confirmed",
      dueKm: 46_000,
    });
    // Same urgency, different grounds: a stated fact with no odometer behind
    // it must not read as a measurement.
    expect(byId.get("reported")).toMatchObject({
      urgency: "overdue",
      confidence: "reported_not_done",
      dueKm: null,
    });
    expect(byId.get("unsure")).toMatchObject({
      urgency: "due_now",
      confidence: "unknown",
    });
  });

  it("gives every motorcycle its worst item before any bike gets a second", () => {
    const rows = [
      ...["a1", "a2", "a3", "a4", "a5"].map((id) =>
        plan({
          id,
          motorcycle_id: "bike-a",
          motorcycle_name: "Moto A",
          maintenance_type: id,
          initial_history_status: "not_done",
        }),
      ),
      plan({
        id: "b1",
        motorcycle_id: "bike-b",
        motorcycle_name: "Moto B",
        maintenance_type: "b1",
        initial_history_status: "not_done",
      }),
    ];

    const items = buildDueNow({
      rows,
      odometerByMotorcycle: new Map([
        ["bike-a", 50_000],
        ["bike-b", 30_000],
      ]),
    });

    expect(items).toHaveLength(5);
    // Without balancing, bike A's five items would fill every slot and hide
    // that a second motorcycle also needs attention.
    expect(items.map((item) => item.id)).toContain("b1");
    expect(items[1].id).toBe("b1");
  });

  it("puts overdue bikes ahead of due-now bikes in the first round", () => {
    const items = buildDueNow({
      rows: [
        plan({
          id: "soft",
          motorcycle_id: "bike-soft",
          motorcycle_name: "Moto Soft",
          initial_history_status: "unknown",
        }),
        plan({
          id: "hard",
          motorcycle_id: "bike-hard",
          motorcycle_name: "Moto Hard",
          initial_history_status: "not_done",
        }),
      ],
      odometerByMotorcycle: new Map(),
    });
    expect(items.map((item) => item.id)).toEqual(["hard", "soft"]);
  });

  it("caps the list at five items", () => {
    const rows = Array.from({ length: 9 }, (_, index) =>
      plan({
        id: `p${index}`,
        motorcycle_id: `bike-${index}`,
        motorcycle_name: `Moto ${index}`,
        initial_history_status: "not_done",
      }),
    );
    expect(buildDueNow({ rows, odometerByMotorcycle: new Map() })).toHaveLength(
      5,
    );
  });

  it("carries the manual reference through when the plan has one", () => {
    const [item] = buildDueNow({
      rows: [
        plan({
          official_url: "https://example.invalid/manual.pdf",
          document_version: "D2203-MAN-1186_WEB",
          page_reference: "p. 32–34",
        }),
      ],
      odometerByMotorcycle: new Map(),
    });
    expect(item.officialUrl).toBe("https://example.invalid/manual.pdf");
    expect(item.pageReference).toBe("p. 32–34");
  });
});

describe("bike home attention ranking", () => {
  const dueItem = (overrides: Partial<DueNowItem> = {}): DueNowItem => ({
    id: "plan-1",
    motorcycleId: "bike-1",
    motorcycleName: "Moto 1",
    maintenanceType: "Óleo do motor",
    urgency: "due_now",
    confidence: "unknown",
    dueKm: 6000,
    estimatedCostCents: 11000,
    officialUrl: "",
    documentVersion: "",
    pageReference: "",
    ...overrides,
  });
  const reminder = (
    overrides: Partial<AttentionReminder> = {},
  ): AttentionReminder => ({
    id: "rem-1",
    title: "Corrente",
    motorcycleId: "bike-1",
    motorcycleName: "Moto 1",
    status: "due_soon",
    remainingKm: 150,
    remainingDays: null,
    ...overrides,
  });

  it("puts an overdue reminder ahead of a plan item that is only due", () => {
    const ranked = rankAttention({
      dueNow: [dueItem()],
      reminders: [
        reminder({ id: "late", status: "overdue", remainingKm: -50 }),
      ],
    });
    expect(ranked.map((item) => [item.id, item.tone])).toEqual([
      ["late", "overdue"],
      ["plan-1", "due"],
    ]);
  });

  it("leaves reminders that are still fine off the list", () => {
    expect(
      rankAttention({
        dueNow: [],
        reminders: [
          reminder({ status: "ok" }),
          reminder({ status: "unknown" }),
        ],
      }),
    ).toEqual([]);
  });

  it("orders reminders of the same tone by the closest due point", () => {
    const ranked = rankAttention({
      dueNow: [],
      reminders: [
        reminder({ id: "far", remainingKm: 190 }),
        reminder({ id: "near", remainingKm: 20 }),
        reminder({ id: "dated", remainingKm: null, remainingDays: 3 }),
      ],
    });
    expect(ranked.map((item) => item.id)).toEqual(["near", "far", "dated"]);
  });

  it("leads the bike home with that bike's item, or a garage-wide one", () => {
    const ranked = rankAttention({
      dueNow: [
        dueItem({
          id: "other-bike",
          motorcycleId: "bike-2",
          urgency: "overdue",
        }),
      ],
      reminders: [
        reminder({ id: "licence", motorcycleId: null, motorcycleName: "" }),
      ],
    });
    expect(mostUrgentFor(ranked, "bike-1")?.id).toBe("licence");
    expect(mostUrgentFor(ranked, "bike-2")?.id).toBe("other-bike");
    expect(
      mostUrgentFor(rankAttention({ dueNow: [], reminders: [] }), "bike-1"),
    ).toBeNull();
  });
});
