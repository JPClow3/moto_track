import { describe, expect, it } from "vitest";
import {
  appToday,
  calendarDay,
  latestCalendarDay,
} from "../../src/lib/utils/calendar-day";

// 22:30 in Brasília on the 28th is already the 29th in UTC.
const evening = new Date("2026-10-29T01:30:00.000Z");

describe("calendar days", () => {
  it("dates an evening in Brasília on the local day, not the UTC one", () => {
    expect(evening.toISOString().slice(0, 10)).toBe("2026-10-29");
    expect(appToday(evening)).toBe("2026-10-28");
  });

  it("formats any zone as YYYY-MM-DD", () => {
    expect(calendarDay(evening, "UTC")).toBe("2026-10-29");
    expect(calendarDay(evening, "Asia/Tokyo")).toBe("2026-10-29");
    expect(calendarDay(new Date("2026-01-05T12:00:00Z"), "UTC")).toBe(
      "2026-01-05",
    );
  });

  it("never rejects a rider who is already on the next day", () => {
    // 01:00 on the 29th in Lisbon is 22:00 on the 28th in Brasília.
    const lisbon = new Date("2026-10-29T01:00:00.000Z");
    expect(appToday(lisbon)).toBe("2026-10-28");
    expect(
      calendarDay(lisbon, "Europe/Lisbon") <= latestCalendarDay(lisbon),
    ).toBe(true);
  });
});
