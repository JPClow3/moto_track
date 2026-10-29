import { describe, expect, it, vi } from "vitest";
import type { Sql } from "postgres";
import { completeReminder } from "$server/domain/reminder-lifecycle";
import { actions } from "../../src/routes/(app)/reminders/+page.server";

vi.mock("$server/domain/odometer", () => ({
  syncMotorcycleOdometer: vi.fn().mockResolvedValue(undefined),
}));

function database(isRecurring = true, isActive = true) {
  const reminder = {
    id: "reminder",
    motorcycle_id: "bike",
    title: "Trocar óleo",
    is_active: isActive,
    is_recurring: isRecurring,
    linked_plan_item_id: null,
    notes: "",
    completion_version: 4,
  };
  const receipts: Array<Record<string, unknown>> = [];
  const queryDb = (query: unknown, ...values: unknown[]): unknown => {
    if (!Array.isArray(query)) return { fragment: query };
    const sql = query.join(" ");
    if (sql.includes('from neon_auth."user"'))
      return Promise.resolve([{ id: "owner" }]);
    if (sql.includes("from reminders")) return Promise.resolve([reminder]);
    if (sql.includes("from motorcycles"))
      return Promise.resolve([{ current_odometer_km: 12345 }]);
    const payload = values.find(
      (value) => value && typeof value === "object" && "fragment" in value,
    ) as { fragment: Record<string, unknown> } | undefined;
    if (sql.includes("insert into maintenance_records"))
      receipts.push(payload!.fragment);
    if (sql.includes("update reminders"))
      Object.assign(reminder, payload!.fragment);
    return Promise.resolve([]);
  };
  const db = Object.assign(queryDb, {
    begin: async (callback: (tx: unknown) => unknown) => callback(queryDb),
  }) as unknown as Sql;
  return { db, reminder, receipts };
}

describe("reminder completion version", () => {
  it.each([0, 3, 5])(
    "rejects stale or future version %i without recording a service",
    async (version) => {
      const { db, reminder, receipts } = database();
      await expect(
        completeReminder(db, "owner", "reminder", version, "2026-10-29"),
      ).rejects.toThrow("Atualize a página antes de concluir o lembrete.");
      expect(receipts).toEqual([]);
      expect(reminder.completion_version).toBe(4);
    },
  );

  it.each([true, false])(
    "records a matching completion once and rejects a retry (recurring: %s)",
    async (recurring) => {
      const { db, reminder, receipts } = database(recurring);
      await expect(
        completeReminder(db, "owner", "reminder", 4, "2026-10-29"),
      ).resolves.toMatchObject({ ok: true, alreadyCompleted: false });
      expect(receipts).toEqual([
        expect.objectContaining({
          owner_id: "owner",
          motorcycle_id: "bike",
          date: "2026-10-29",
          odometer_km: 12345,
        }),
      ]);
      expect(reminder.completion_version).toBe(5);
      expect(reminder.is_active).toBe(recurring);
      await expect(
        completeReminder(db, "owner", "reminder", 4, "2026-10-29"),
      ).rejects.toThrow("Atualize a página antes de concluir o lembrete.");
      expect(receipts).toHaveLength(1);
    },
  );

  it("rejects an inactive reminder even when its version still matches", async () => {
    const { db, receipts } = database(false, false);
    await expect(
      completeReminder(db, "owner", "reminder", 4, "2026-10-29"),
    ).rejects.toThrow("Atualize a página antes de concluir o lembrete.");
    expect(receipts).toEqual([]);
  });

  it.each([
    ["pt-BR", "Atualize a página antes de concluir o lembrete."],
    ["en", "Refresh the page before completing the reminder."],
  ])(
    "returns a visible action failure in %s for stale completion",
    async (locale, message) => {
      const { db, receipts } = database();
      const form = new FormData();
      form.set("id", "reminder");
      form.set("completion_version", "3");
      const result = await actions.complete({
        locals: { db, user: { id: "owner" }, locale },
        request: new Request("https://app.example/reminders?/complete", {
          method: "POST",
          body: form,
        }),
      } as never);
      expect(result).toMatchObject({ status: 400, data: { message } });
      expect(receipts).toEqual([]);
    },
  );
});
