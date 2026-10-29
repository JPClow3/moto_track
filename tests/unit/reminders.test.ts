import { describe, expect, it } from "vitest";
import {
  documentExpiryStatus,
  evaluateReminder,
  sortByUrgency,
} from "../../src/lib/server/domain/reminders";

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

  it("defers both axes of a combined reminder without moving the service reference", () => {
    const reminder = {
      trigger_type: "by_interval" as const,
      reference_km: 1000,
      trigger_value_km: 500,
      reference_date: "2026-01-01",
      trigger_value_days: 30,
      snoozed_until_date: "2026-07-13",
    };
    expect(
      evaluateReminder(reminder, {
        currentOdometerKm: 2000,
        today: "2026-07-06",
      }),
    ).toMatchObject({ status: "ok", snoozed: true, due_date: "2026-07-13" });
    expect(
      evaluateReminder(reminder, {
        currentOdometerKm: 2000,
        today: "2026-07-13",
      }).status,
    ).toBe("overdue");
    expect(reminder.reference_date).toBe("2026-01-01");
    expect(reminder.reference_km).toBe(1000);
  });

  it("keeps date-overdue combined reminders quiet until a chosen mileage deferral", () => {
    const reminder = {
      trigger_type: "by_interval" as const,
      reference_km: 1000,
      trigger_value_km: 500,
      reference_date: "2026-01-01",
      trigger_value_days: 30,
      snoozed_until_km: 2500,
    };
    expect(
      evaluateReminder(reminder, {
        currentOdometerKm: 2000,
        today: "2026-07-06",
      }),
    ).toMatchObject({ status: "ok", snoozed: true, due_km: 2500 });
    expect(
      evaluateReminder(reminder, {
        currentOdometerKm: 2500,
        today: "2026-07-06",
      }).status,
    ).toBe("overdue");
  });

  it("normalizes PostgreSQL dates and refuses invalid dates or mileage", () => {
    expect(
      evaluateReminder(
        {
          trigger_type: "by_date",
          reference_date: new Date("2026-07-01T00:00:00Z"),
          trigger_value_days: 10,
        },
        { currentOdometerKm: 0, today: "2026-07-06" },
      ).status,
    ).toBe("due_soon");
    expect(
      evaluateReminder(
        {
          trigger_type: "by_date",
          reference_date: "2026-02-30",
          trigger_value_days: 1,
        },
        { currentOdometerKm: 0, today: "2026-07-06" },
      ).status,
    ).toBe("unknown");
    expect(
      evaluateReminder(
        {
          trigger_type: "by_km",
          reference_km: 0,
          trigger_value_km: Number.NaN,
        },
        { currentOdometerKm: 0, today: "2026-07-06" },
      ).status,
    ).toBe("unknown");
  });
});

describe("sortByUrgency", () => {
  it("puts overdue first and paused last, keeping ties in order", () => {
    const rows = [
      { id: "a", status: "ok" },
      { id: "b", status: "inactive" },
      { id: "c", status: "overdue" },
      { id: "d", status: "unknown" },
      { id: "e", status: "due_soon" },
      { id: "f", status: "overdue" },
    ] as const;
    expect(
      sortByUrgency(rows, (row) => row.status).map((row) => row.id),
    ).toEqual(["c", "f", "e", "a", "d", "b"]);
  });
});

describe("documentExpiryStatus", () => {
  const today = "2026-07-06";

  it("is still valid on its last day and expired the day after", () => {
    expect(documentExpiryStatus("2026-07-06", 0, today)).toBe("due_soon");
    expect(documentExpiryStatus("2026-07-05", 30, today)).toBe("overdue");
  });

  it("uses the document's notice window, defaulting to 30 days", () => {
    expect(documentExpiryStatus("2026-07-20", 10, today)).toBe("ok");
    expect(documentExpiryStatus("2026-07-20", 14, today)).toBe("due_soon");
    expect(documentExpiryStatus("2026-08-01", null, today)).toBe("due_soon");
    expect(documentExpiryStatus("2026-09-01", null, today)).toBe("ok");
  });

  it("is unknown without a valid date", () => {
    expect(documentExpiryStatus(null, 30, today)).toBe("unknown");
    expect(documentExpiryStatus("2026-02-30", 30, today)).toBe("unknown");
    expect(
      documentExpiryStatus(new Date("2026-06-01T00:00:00Z"), 30, today),
    ).toBe("overdue");
  });
});
