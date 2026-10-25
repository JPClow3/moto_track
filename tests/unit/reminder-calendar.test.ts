import { describe, expect, it } from "vitest";
import {
  buildReminderCalendar,
  type CalendarReminder,
} from "$server/domain/reminder-calendar";

const now = new Date("2026-10-23T12:00:00Z");
const base: CalendarReminder = {
  id: "a-b-c",
  title: "Trocar óleo",
  motorcycle_name: "CG 160",
  motorcycle_id: "bike",
  current_odometer_km: 1500,
  trigger_type: "by_date",
  reference_date: "2026-10-20",
  reference_km: 1000,
  trigger_value_days: 7,
  trigger_value_km: 1000,
};

describe("reminder calendars", () => {
  it("applies snooze gates to every trigger axis and withholds unknown mileage dates", () => {
    expect(
      buildReminderCalendar(
        [{ ...base, snoozed_until_date: "2026-11-01" }],
        now,
      ),
    ).toContain("DTSTART;VALUE=DATE:20261101");
    expect(
      buildReminderCalendar([{ ...base, snoozed_until_km: 2500 }], now),
    ).not.toContain("BEGIN:VEVENT");
    expect(
      buildReminderCalendar(
        [{ ...base, snoozed_until_km: 2500, km_per_day: 100 }],
        now,
      ),
    ).toContain("DTSTART;VALUE=DATE:20261102");
    expect(
      buildReminderCalendar([{ ...base, snoozed_until_km: 1400 }], now),
    ).toContain("DTSTART;VALUE=DATE:20261027");
    expect(
      buildReminderCalendar(
        [{ ...base, current_odometer_km: null, snoozed_until_km: 2500 }],
        now,
      ),
    ).not.toContain("BEGIN:VEVENT");
  });
  it("exports an all-day private event with stable UID and exclusive end date", () => {
    const calendar = buildReminderCalendar([base], now);
    expect(calendar).toContain(
      "DTSTART;VALUE=DATE:20261027\r\nDTEND;VALUE=DATE:20261028",
    );
    expect(calendar).toContain("UID:reminder-a-b-c@moto-track.net");
    expect(calendar).toContain("CLASS:PRIVATE");
    expect(calendar).toContain("DTSTAMP:20261023T120000Z");
    expect(calendar.endsWith("END:VCALENDAR\r\n")).toBe(true);
  });
  it("does not invent dates for mileage-only reminders without observed pace", () => {
    expect(
      buildReminderCalendar([{ ...base, trigger_type: "by_km" }], now),
    ).not.toContain("BEGIN:VEVENT");
    expect(
      buildReminderCalendar(
        [{ ...base, trigger_type: "by_km", km_per_day: 50 }],
        now,
      ),
    ).toContain("DTSTART;VALUE=DATE:20261102");
  });
  it("exports the earlier interval and handles a PostgreSQL date", () => {
    expect(
      buildReminderCalendar(
        [
          {
            ...base,
            trigger_type: "by_interval",
            reference_date: new Date("2026-10-20"),
            km_per_day: 50,
          },
        ],
        now,
      ),
    ).toContain("DTSTART;VALUE=DATE:20261027");
  });
  it("escapes calendar injection and folds Portuguese text without breaking UTF-8", () => {
    const calendar = buildReminderCalendar(
      [
        {
          ...base,
          title:
            "Óleo; revisão, teste\\\nEND:VEVENT\nBEGIN:VEVENT\n" +
            "ç".repeat(100),
        },
      ],
      now,
    );
    expect(
      calendar.split("\r\n").filter((line) => line === "BEGIN:VEVENT"),
    ).toHaveLength(1);
    expect(calendar).toContain("\\; revisão\\, teste\\\\\\nEND:VEVENT");
    for (const line of calendar.split("\r\n"))
      expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
    expect(calendar).not.toContain("�");
  });
  it("skips invalid date and negative interval inputs", () => {
    const calendar = buildReminderCalendar(
      [
        { ...base, reference_date: "2026-02-31" },
        { ...base, trigger_value_days: -1 },
      ],
      now,
    );
    expect(calendar).not.toContain("BEGIN:VEVENT");
  });
});
