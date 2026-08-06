import { describe, expect, it } from "vitest";
import { buildDueNow } from "$server/domain/due-now";

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
