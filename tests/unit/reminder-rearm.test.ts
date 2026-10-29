import { describe, expect, it } from "vitest";
import { reminderScheduleChanged } from "../../src/lib/server/domain/reminders";

const stored = {
  motorcycle_id: "bike",
  trigger_type: "by_date",
  trigger_value_km: null,
  trigger_value_days: 0,
  reference_km: null,
  // postgres.js hands `date` columns back as Date.
  reference_date: new Date("2026-09-01T00:00:00.000Z"),
  is_active: true,
};

describe("reminder re-arming", () => {
  it("re-arms when a renewed document moves the due date", () => {
    expect(
      reminderScheduleChanged(stored, {
        ...stored,
        reference_date: "2027-09-01",
      }),
    ).toBe(true);
  });

  it("keeps the notification stamp when the due point is unchanged", () => {
    expect(
      reminderScheduleChanged(stored, {
        trigger_type: "by_date",
        trigger_value_days: "0",
        reference_date: "2026-09-01",
        title: "Documento vence: CRLV",
      }),
    ).toBe(false);
  });

  it("re-arms on a new mileage target or reactivation", () => {
    const byKm = { ...stored, trigger_type: "by_km", reference_km: 1000 };
    expect(reminderScheduleChanged(byKm, { reference_km: 6000 })).toBe(true);
    expect(
      reminderScheduleChanged(
        { ...stored, is_active: false },
        { is_active: true },
      ),
    ).toBe(true);
  });
});
