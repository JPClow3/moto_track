import { describe, expect, it, vi } from "vitest";
import { featureActions } from "$server/domain/crud";
import { load, actions } from "../../src/routes/(app)/maintenance/+page.server";
import {
  maintenanceOccurrenceOptions,
  nextScheduleMilestone,
} from "$server/domain/maintenance-schedule";
import { dueStateForPlan } from "$server/domain/motorcycle-catalog";

vi.mock("$server/domain/record-sync", () => ({
  syncLinkedReminder: vi.fn(),
  syncPlanReminder: vi.fn().mockResolvedValue({ ok: true }),
}));
vi.mock("$server/domain/odometer-history", () => ({
  loadOdometerHistory: vi.fn().mockResolvedValue(new Map()),
}));

function recordDatabase(table = "maintenance_records", failHistory = false) {
  const state = {
    record: {
      id: "record",
      motorcycle_id: "old-bike",
      odometer_km: 10_000,
      completion_version: 4,
    } as Record<string, unknown>,
    odometers: { "old-bike": 10_000, "new-bike": 500 } as Record<
      string,
      number
    >,
  };
  const updates: Array<{ motorcycle: string; transactional: boolean }> = [];
  let transactional = false;
  const queryDb = (query: unknown, ...values: unknown[]): unknown => {
    if (!Array.isArray(query)) return { fragment: query };
    const sql = query.join(" ");
    if (
      sql.includes('from neon_auth."user"') &&
      sql.includes("for no key update")
    ) {
      if (!transactional) throw new Error("Owner lock must be transactional");
      return Promise.resolve(values[0] === "owner" ? [{ id: "owner" }] : []);
    }
    const identifier = (values[0] as { fragment?: string })?.fragment;
    if (sql.includes("select id from motorcycles") && sql.includes("for share"))
      return Promise.resolve([{ id: String(values[0]) }]);
    if (sql.includes("select * from") && identifier === table)
      return Promise.resolve([{ ...state.record }]);
    if (sql.includes("update ") && identifier === table) {
      Object.assign(state.record, (values[1] as { fragment: object }).fragment);
      return Promise.resolve([{ id: "record" }]);
    }
    if (sql.includes("select odometer_override_km"))
      return Promise.resolve([
        { odometer_override_km: values[0] === "old-bike" ? 1000 : 500 },
      ]);
    if (sql.includes("select odometer_km from maintenance_records")) {
      return Promise.resolve(
        state.record.motorcycle_id === values[0]
          ? [{ odometer_km: state.record.odometer_km }]
          : [],
      );
    }
    if (sql.includes("from work_sessions") && failHistory)
      return Promise.reject(new Error("history unavailable"));
    if (sql.includes("update motorcycles")) {
      const motorcycle = String(values[2]);
      state.odometers[motorcycle] = Number(values[0]);
      updates.push({ motorcycle, transactional });
    }
    return Promise.resolve([]);
  };
  const db = Object.assign(queryDb, {
    begin: async (callback: (tx: unknown) => Promise<unknown>) => {
      const snapshot = structuredClone(state);
      transactional = true;
      try {
        return await callback(queryDb);
      } catch (cause) {
        Object.assign(state, snapshot);
        throw cause;
      } finally {
        transactional = false;
      }
    },
  });
  return { db, state, updates };
}

const event = (db: unknown, values: Record<string, string>) => ({
  locals: { db, user: { id: "owner" }, locale: "pt-BR" },
  request: new Request("https://app.test/maintenance", {
    method: "POST",
    body: new URLSearchParams(values),
  }),
});

describe("maintenance history correction boundaries", () => {
  it("offers item occurrences instead of accepting a global booklet review number", () => {
    for (const rule of [
      {
        milestones: [{ km: 6000, months: 18 }],
        recurrenceKm: 6000,
        recurrenceMonths: 12,
        expectedKm: 12000,
        expectedMonths: 30,
      },
      {
        milestones: [{ km: 12000, months: 30 }],
        recurrenceKm: 12000,
        recurrenceMonths: 24,
        expectedKm: 24000,
        expectedMonths: 54,
      },
    ]) {
      const options = maintenanceOccurrenceOptions(rule);
      expect(options[0]).toEqual({ ordinal: 1, ...rule.milestones[0] });
      expect(options[1]).toEqual({
        ordinal: 2,
        km: rule.expectedKm,
        months: rule.expectedMonths,
      });
      expect(
        nextScheduleMilestone({
          ...rule,
          completedMilestone: options[0].ordinal,
        }),
      ).toMatchObject({
        dueKm: rule.expectedKm,
        dueMonths: rule.expectedMonths,
      });
    }
  });

  it("recomputes source and destination mileage inside the write transaction", async () => {
    const { db, state, updates } = recordDatabase();
    const result = await featureActions("maintenance").default!(
      event(db, {
        _intent: "update",
        id: "record",
        motorcycle_id: "new-bike",
        date: "2026-10-23",
        odometer_km: "10000",
        maintenance_type: "oil",
      }) as never,
    );
    expect(result).toMatchObject({ ok: true });
    expect(state.odometers).toEqual({ "old-bike": 1000, "new-bike": 10000 });
    expect(updates).toEqual([
      { motorcycle: "old-bike", transactional: true },
      { motorcycle: "new-bike", transactional: true },
    ]);
  });

  it("rolls back the movement when an odometer source cannot be read", async () => {
    const { db, state, updates } = recordDatabase("maintenance_records", true);
    const result = await featureActions("maintenance").default!(
      event(db, {
        _intent: "update",
        id: "record",
        motorcycle_id: "new-bike",
        date: "2026-10-23",
        odometer_km: "10000",
        maintenance_type: "oil",
      }) as never,
    );
    expect(result).toMatchObject({
      status: 400,
      data: { message: "history unavailable" },
    });
    expect(state.record.motorcycle_id).toBe("old-bike");
    expect(state.odometers).toEqual({ "old-bike": 10000, "new-bike": 500 });
    expect(updates).toEqual([]);
  });

  it("invalidates rendered reminder completions using the locked server version", async () => {
    const { db, state } = recordDatabase("reminders");
    await featureActions("reminders").default!(
      event(db, {
        _intent: "update",
        id: "record",
        motorcycle_id: "old-bike",
        title: "Edited reminder",
        trigger_type: "by_date",
        reference_date: "2026-10-23",
        completion_version: "9999",
      }) as never,
    );
    expect(state.record.completion_version).toBe(5);
  });

  it("returns PostgreSQL dates ready for service correction date inputs", async () => {
    const db = (query: TemplateStringsArray) =>
      Promise.resolve(
        query.join(" ").includes("select r.*, m.name")
          ? [{ id: "record", date: new Date("2026-10-23T00:00:00Z") }]
          : [],
      );
    const result = await load({
      locals: { db, user: { id: "owner" } },
    } as never);
    expect(result.rows[0].date).toBe("2026-10-23");
  });

  it("requires explicit consent before replacing manufacturer phases", async () => {
    const writes: string[] = [];
    const queryDb = (query: unknown) => {
      if (!Array.isArray(query)) return { fragment: query };
      const sql = query.join(" ");
      if (sql.includes("select id from motorcycles"))
        return Promise.resolve([{ id: "bike" }]);
      if (sql.includes("select id, schedule_milestones"))
        return Promise.resolve([
          { id: "plan", schedule_milestones: [{ km: 6000, months: 18 }] },
        ]);
      if (sql.includes("update maintenance_plan_items")) writes.push(sql);
      if (sql.includes("insert into maintenance_plan_items"))
        return Promise.resolve([{ id: "plan" }]);
      return Promise.resolve([]);
    };
    const db = Object.assign(queryDb, {
      begin: async (callback: (tx: unknown) => unknown) => callback(queryDb),
    });
    const result = await actions.savePlan(
      event(db, {
        motorcycle_id: "bike",
        maintenance_type: "valves",
        interval_km: "2000",
      }) as never,
    );
    expect(result).toMatchObject({ status: 400 });
    expect(writes).toEqual([]);
    const confirmed = await actions.savePlan(
      event(db, {
        motorcycle_id: "bike",
        maintenance_type: "valves",
        interval_km: "2000",
        convert_manufacturer_plan: "true",
      }) as never,
    );
    expect(confirmed).toMatchObject({ ok: true });
    expect(writes).toHaveLength(1);
    expect(writes[0]).toContain("schedule_milestones = '[]'::jsonb");
    expect(writes[0]).toContain("manual_source_id = null");
  });

  it("keeps a saved plan when the reminder cap blocks its reminder", async () => {
    const { syncPlanReminder } = await import("$server/domain/record-sync");
    vi.mocked(syncPlanReminder).mockResolvedValueOnce({
      ok: false,
      message: "Limite de lembretes atingido.",
    });
    const inserts: string[] = [];
    let committed = false;
    const queryDb = (query: unknown) => {
      if (!Array.isArray(query)) return { fragment: query };
      const sql = query.join(" ");
      if (sql.includes("select id from motorcycles"))
        return Promise.resolve([{ id: "bike" }]);
      if (sql.includes("insert into maintenance_plan_items")) {
        inserts.push(sql);
        return Promise.resolve([{ id: "plan" }]);
      }
      return Promise.resolve([]);
    };
    const db = Object.assign(queryDb, {
      begin: async (callback: (tx: unknown) => unknown) => {
        const result = await callback(queryDb);
        committed = true;
        return result;
      },
    });
    const result = await actions.savePlan(
      event(db, {
        motorcycle_id: "bike",
        maintenance_type: "valves",
        interval_km: "2000",
      }) as never,
    );
    expect(committed).toBe(true);
    expect(inserts).toHaveLength(1);
    expect(result).toMatchObject({
      status: 403,
      data: { message: "Limite de lembretes atingido." },
    });
  });

  it("can schedule a pure replacement from a confirmed date without inventing its count", () => {
    const rule = {
      milestones: [{ km: null, months: 36 }],
      recurrenceKm: null,
      recurrenceMonths: 36,
      completedMilestone: null,
      calendarAnchorMode: "last_service" as const,
      lastServiceDate: "2026-02-28",
    };
    expect(nextScheduleMilestone(rule)).toMatchObject({
      nextMilestone: null,
      dueKm: null,
      dueDate: "2029-02-28",
    });
    expect(
      dueStateForPlan({
        historyStatus: "confirmed_done",
        lastDoneKm: null,
        intervalKm: null,
        currentKm: 1000,
        scheduleMilestones: rule.milestones,
        recurrenceKm: null,
        recurrenceMonths: 36,
        lastCompletedMilestone: null,
        lastDoneDate: rule.lastServiceDate,
        calendarAnchorMode: "last_service",
        today: "2026-10-23",
      }),
    ).toEqual({ urgency: "scheduled", dueKm: null });
    expect(
      nextScheduleMilestone({
        ...rule,
        milestones: [
          { km: null, months: 6 },
          { km: null, months: 36 },
        ],
      }),
    ).toMatchObject({ nextMilestone: null, dueDate: null });
    expect(
      nextScheduleMilestone({
        ...rule,
        milestones: [{ km: 12000, months: 36 }],
      }),
    ).toMatchObject({ nextMilestone: null, dueDate: null });
  });
});
