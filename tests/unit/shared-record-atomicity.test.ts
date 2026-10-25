import { beforeEach, describe, expect, it, vi } from "vitest";
import { actions } from "../../src/routes/(app)/garage/shared/[accessId]/+page.server";

const effects = vi.hoisted(() => ({ linked: vi.fn() }));
vi.mock("$server/domain/record-sync", () => ({
  syncLinkedReminder: effects.linked,
}));

const accessId = "00000000-0000-4000-8000-000000000001";

function database(fault?: "history" | "cache", role = "workshop") {
  const state = {
    records: [] as Array<Record<string, unknown>>,
    fuel: [] as Array<Record<string, unknown>>,
    activity: [] as unknown[],
    odometer: 1000,
  };
  let recordWrites = 0;
  const queries: Array<{ query: string; values: unknown[] }> = [];
  const queryDb = (input: unknown, ...values: unknown[]): unknown => {
    if (!Array.isArray(input)) return input;
    const query = input.join("?");
    queries.push({ query, values });
    if (query.includes("from garage_memberships")) {
      return Promise.resolve([
        {
          id: accessId,
          owner_id: "owner",
          member_id: "member",
          role,
        },
      ]);
    }
    if (query.includes('select id from neon_auth."user"'))
      return Promise.resolve([{ id: "owner" }]);
    if (query.includes("select id from motorcycles"))
      return Promise.resolve([{ id: "motorcycle" }]);
    if (query.includes("select odometer_override_km"))
      return Promise.resolve([{ odometer_override_km: 1000 }]);
    if (query.includes("select odometer_km from maintenance_records")) {
      if (fault === "history")
        return Promise.reject(new Error("history unavailable"));
      return Promise.resolve(state.records);
    }
    if (
      query.includes("select odometer_km from fuel_records") ||
      query.includes("select installed_odometer_km from tire_records") ||
      query.includes("select odometer_end_km from work_sessions")
    )
      return Promise.resolve([]);
    if (query.includes("update motorcycles")) {
      if (fault === "cache")
        return Promise.reject(new Error("cache unavailable"));
      state.odometer = Number(values[0]);
      return Promise.resolve([]);
    }
    if (query.includes("insert into garage_activity")) {
      state.activity.push(values.at(-1));
      return Promise.resolve([]);
    }
    if (query.includes("insert into") && values[0] === "maintenance_records") {
      state.records.push({ ...(values[1] as Record<string, unknown>) });
      recordWrites++;
      return Promise.resolve([]);
    }
    if (query.includes("insert into") && values[0] === "fuel_records") {
      state.fuel.push({ ...(values[1] as Record<string, unknown>) });
      return Promise.resolve([]);
    }
    return Promise.resolve([]);
  };
  const db = Object.assign(queryDb, {
    begin: async (callback: (tx: unknown) => Promise<unknown>) => {
      const snapshot = structuredClone(state);
      try {
        return await callback(queryDb);
      } catch (cause) {
        Object.assign(state, snapshot);
        throw cause;
      }
    },
  });
  return { db, state, queries, writes: () => recordWrites };
}

function event(
  db: unknown,
  body: Record<string, string> = {
    feature: "maintenance",
    motorcycle_id: "motorcycle",
    date: "2026-10-01",
    odometer_km: "1500",
    maintenance_type: "Oil change",
    cost_cents: "30",
  },
) {
  return {
    locals: { db, user: { id: "member" }, locale: "pt-BR" },
    params: { accessId },
    request: new Request(`https://app.test/garage/shared/${accessId}?/record`, {
      method: "POST",
      body: new URLSearchParams(body),
    }),
  };
}

describe("shared-garage record and derived-state atomicity", () => {
  beforeEach(() => {
    effects.linked.mockReset().mockResolvedValue(undefined);
  });

  it.each(["history", "cache"] as const)(
    "rolls back the inserted record when the real odometer %s query fails",
    async (fault) => {
      const fixture = database(fault);
      const result = await actions.record(event(fixture.db) as never);
      expect(result).toMatchObject({ status: 400 });
      expect(fixture.writes()).toBe(1);
      expect(fixture.state).toEqual({
        records: [],
        fuel: [],
        activity: [],
        odometer: 1000,
      });
      expect(effects.linked).not.toHaveBeenCalled();
    },
  );

  it("rolls back the inserted record and updated odometer when the reminder fails", async () => {
    const fixture = database();
    effects.linked.mockRejectedValueOnce(new Error("reminder unavailable"));
    const result = await actions.record(event(fixture.db) as never);
    expect(result).toMatchObject({ status: 400 });
    expect(fixture.writes()).toBe(1);
    expect(fixture.state).toEqual({
      records: [],
      fuel: [],
      activity: [],
      odometer: 1000,
    });
  });

  it("never stores another account's station or grade on a shared fuel record", async () => {
    const fixture = database(undefined, "contributor");
    const result = await actions.record(
      event(fixture.db, {
        feature: "fuel",
        motorcycle_id: "motorcycle",
        date: "2026-10-01",
        odometer_km: "1500",
        liters: "10",
        total_price_cents: "60",
        station_id: "foreign-station",
        fuel_grade_id: "foreign-grade",
      }) as never,
    );
    expect(result).toEqual({ ok: true });
    expect(fixture.state.fuel).toHaveLength(1);
    expect(fixture.state.fuel[0]).toMatchObject({ owner_id: "owner" });
    expect(fixture.state.fuel[0]).not.toHaveProperty("station_id");
    expect(fixture.state.fuel[0]).not.toHaveProperty("fuel_grade_id");
  });

  it("commits the record, odometer and audit activity for the garage owner", async () => {
    const fixture = database();
    const result = await actions.record(event(fixture.db) as never);
    expect(result).toEqual({ ok: true });
    expect(fixture.state.odometer).toBe(1500);
    expect(fixture.state.records).toHaveLength(1);
    expect(fixture.state.records[0]).toMatchObject({
      owner_id: "owner",
      odometer_km: 1500,
    });
    expect(fixture.state.activity).toEqual([fixture.state.records[0].id]);
  });

  it("holds the actor before the owner and revalidated membership during the write", async () => {
    const fixture = database();
    expect(await actions.record(event(fixture.db) as never)).toEqual({
      ok: true,
    });
    const actor = fixture.queries.findIndex(({ query }) =>
      query.includes("for key share"),
    );
    const owner = fixture.queries.findIndex(({ query }) =>
      query.includes("for no key update"),
    );
    const memberships = fixture.queries.flatMap(({ query }, index) =>
      query.includes("from garage_memberships") ? [index] : [],
    );
    const audit = fixture.queries.findIndex(({ query }) =>
      query.includes("insert into garage_activity"),
    );
    expect(actor).toBeGreaterThanOrEqual(0);
    expect(fixture.queries[actor].values).toEqual(["member"]);
    expect(owner).toBeGreaterThan(actor);
    expect(fixture.queries[owner].values).toEqual(["owner"]);
    expect(memberships).toHaveLength(2);
    expect(memberships[1]).toBeGreaterThan(owner);
    expect(audit).toBeGreaterThan(memberships[1]);
  });
});
