import { describe, expect, it } from "vitest";
import { evaluateReminder } from "../../src/lib/server/domain/reminders";

describe("evaluateReminder", () => {
  it("marks km reminders overdue", () => {
    expect(
      evaluateReminder(
        { trigger_type: "by_km", reference_km: 1000, trigger_value_km: 500 },
        { currentOdometerKm: 1501, today: "2026-07-06" },
      ).status,
    ).toBe("overdue");
  });

  it("marks date reminders due soon", () => {
    expect(
      evaluateReminder(
        {
          trigger_type: "by_date",
          reference_date: "2026-07-01",
          trigger_value_days: 10,
        },
        { currentOdometerKm: 0, today: "2026-07-06" },
      ).status,
    ).toBe("due_soon");
  });
});
