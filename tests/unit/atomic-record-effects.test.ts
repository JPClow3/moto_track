import { beforeEach, describe, expect, it, vi } from "vitest";
import { featureActions } from "$server/domain/crud";
import { actions as maintenance } from "../../src/routes/(app)/maintenance/+page.server";
import { actions as fuel } from "../../src/routes/(app)/fuel/+page.server";
import { actions as insurance } from "../../src/routes/(app)/expenses/+page.server";
import {
  POST,
  PATCH,
  DELETE,
} from "../../src/routes/api/v1/[resource]/+server";

const effects = vi.hoisted(() => ({
  linked: vi.fn(),
  insurance: vi.fn(),
  clear: vi.fn(),
  odometer: vi.fn(),
}));
vi.mock("$server/domain/record-sync", () => ({
  syncLinkedReminder: effects.linked,
  syncInsuranceReminder: effects.insurance,
  clearInsuranceReminder: effects.clear,
  syncPlanReminder: vi.fn(),
}));
vi.mock("$server/domain/odometer", () => ({
  syncMotorcycleOdometer: effects.odometer,
}));
vi.mock("$server/domain/api-auth", () => ({
  requireApiUser: vi.fn().mockResolvedValue({ user: { id: "owner" } }),
}));

function database() {
  const initial = {
    id: "record",
    owner_id: "owner",
    motorcycle_id: "owned",
    date: "2026-10-01",
    name: "Original record",
  };
  const state = {
    record: { ...initial } as Record<string, unknown> | null,
    preferences: 0,
  };
  let mutationReached = false;
  const queryDb = (input: unknown, ...values: unknown[]): unknown => {
    if (!Array.isArray(input)) return input;
    const query = input.join("?");
    if (query.includes('select id from neon_auth."user"'))
      return Promise.resolve([{ id: "owner" }]);
    if (query.includes("select id from motorcycles"))
      return Promise.resolve([{ id: "owned" }]);
    if (
      query.includes("select motorcycle_id from") ||
      query.includes("select * from")
    )
      return Promise.resolve(state.record ? [state.record] : []);
    if (query.includes("from object_files")) return Promise.resolve([]);
    if (query.includes("insert into fuel_preferences")) {
      state.preferences++;
      return Promise.resolve([]);
    }
    if (
      query.includes("insert into") ||
      (query.includes("update ") && query.includes("returning"))
    ) {
      const value = values.find(
        (candidate) => candidate !== null && typeof candidate === "object",
      );
      const payload = Array.isArray(value) ? value[0] : value;
      state.record = { ...state.record, ...(payload as object) };
      mutationReached = true;
      return Promise.resolve([{ ...state.record }]);
    }
    if (query.includes("delete from") && !query.includes("object_files")) {
      state.record = null;
      mutationReached = true;
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
  return { db, state, initial, mutated: () => mutationReached };
}

const document = {
  motorcycle_id: "owned",
  name: "Changed document",
  document_type: "registration",
  valid_until: "2027-01-01",
};
const fuelFields = {
  motorcycle_id: "owned",
  date: "2026-10-23",
  odometer_km: "1200",
  liters: "5",
  total_price: "30",
};
function event(db: unknown, values: Record<string, string>, json = false) {
  return {
    locals: { db, user: { id: "owner" }, locale: "pt-BR" },
    params: { resource: "documents" },
    request: new Request("https://app.test/api/v1/documents?id=record", {
      method: "POST",
      ...(json
        ? {
            headers: { "content-type": "application/json" },
            body: JSON.stringify(values),
          }
        : { body: new URLSearchParams(values) }),
    }),
  };
}

describe("record and derived-state atomicity", () => {
  beforeEach(() => {
    for (const effect of Object.values(effects))
      effect.mockReset().mockResolvedValue(undefined);
    effects.insurance.mockResolvedValue({ ok: true });
  });

  it.each(["create", "update", "delete"])(
    "rolls back generic %s when the linked reminder fails",
    async (intent) => {
      const fixture = database();
      effects.linked.mockRejectedValueOnce(new Error("reminder unavailable"));
      const result = await featureActions("documents").default!(
        event(fixture.db, {
          ...document,
          _intent: intent,
          id: "record",
        }) as never,
      );
      expect(result).toMatchObject({ status: 400 });
      expect(fixture.mutated()).toBe(true);
      expect(fixture.state.record).toEqual(fixture.initial);
    },
  );

  it.each([POST, PATCH, DELETE])(
    "rolls back API writes/deletes when the linked reminder fails",
    async (handler) => {
      const fixture = database();
      effects.linked.mockRejectedValueOnce(new Error("reminder unavailable"));
      await expect(
        handler(
          event(fixture.db, { ...document, id: "record" }, true) as never,
        ),
      ).rejects.toMatchObject({ status: 400 });
      expect(fixture.mutated()).toBe(true);
      expect(fixture.state.record).toEqual(fixture.initial);
    },
  );

  it.each(["reminder", "odometer"])(
    "rolls back maintenance deletion when its %s update fails",
    async (effect) => {
      const fixture = database();
      (effect === "reminder"
        ? effects.linked
        : effects.odometer
      ).mockRejectedValueOnce(new Error("derived state unavailable"));
      const result = await maintenance.deleteRecord(
        event(fixture.db, { id: "record" }) as never,
      );
      expect(result).toMatchObject({ status: 400 });
      expect(fixture.mutated()).toBe(true);
      expect(fixture.state.record).toEqual(fixture.initial);
    },
  );

  it.each(["createRecord", "importConfirm", "deleteRecord"])(
    "rolls back fuel %s when the strict mileage update fails",
    async (action) => {
      const fixture = database();
      effects.odometer.mockRejectedValueOnce(new Error("odometer unavailable"));
      const rows = JSON.stringify([
        {
          date: "2026-10-23",
          odometer_km: 1200,
          liters: 5,
          total_price_cents: 3000,
          price_per_liter_millicents: 600000,
          fuel_type: "gasoline",
          tank_full: true,
          station_name: "original",
          notes: "",
        },
      ]);
      const result = await fuel[action]!(
        event(fixture.db, {
          ...fuelFields,
          id: "record",
          rows_json: rows,
        }) as never,
      );
      expect(result).toMatchObject({ status: 400 });
      expect(fixture.mutated()).toBe(true);
      expect(fixture.state.record).toEqual(fixture.initial);
      expect(fixture.state.preferences).toBe(0);
    },
  );

  it.each(["savePolicy", "deletePolicy"] as const)(
    "rolls back insurance %s when its reminder update fails",
    async (action) => {
      const fixture = database();
      (action === "savePolicy"
        ? effects.insurance
        : effects.clear
      ).mockRejectedValueOnce(new Error("insurance reminder unavailable"));
      const result = await insurance[action](
        event(fixture.db, {
          id: "record",
          motorcycle_id: "owned",
          provider: "Changed insurer",
          coverage_start: "2026-01-01",
          coverage_end: "2027-01-01",
        }) as never,
      );
      expect(result).toMatchObject({ status: 400 });
      expect(fixture.mutated()).toBe(true);
      expect(fixture.state.record).toEqual(fixture.initial);
    },
  );

  it("keeps the documented saved-policy warning when only the reminder cap blocks creation", async () => {
    const fixture = database();
    effects.insurance.mockResolvedValueOnce({
      ok: false,
      message: "Reminder cap",
    });
    const result = await insurance.savePolicy(
      event(fixture.db, {
        id: "record",
        motorcycle_id: "owned",
        provider: "Changed insurer",
        coverage_start: "2026-01-01",
        coverage_end: "2027-01-01",
      }) as never,
    );
    expect(result).toMatchObject({
      status: 403,
      data: { message: expect.stringContaining("Seguro salvo") },
    });
    expect(fixture.state.record?.provider).toBe("Changed insurer");
  });
});
