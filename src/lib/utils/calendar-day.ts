/**
 * Calendar days are wall-clock days, not UTC slices. `toISOString()` is a UTC
 * date, so from 21:00 in Brasília it already reports tomorrow — fuel fills,
 * completions and snoozes logged in the evening were dated a day late.
 */

/** The product's home zone; there is no per-account time zone yet. */
export const APP_TIME_ZONE = "America/Sao_Paulo";

/** UTC+14: the first place on Earth to reach any given calendar day. */
const EARLIEST_TIME_ZONE = "Pacific/Kiritimati";

/** YYYY-MM-DD for `now` in `timeZone`, or in the runtime's own zone when omitted. */
export function calendarDay(now = new Date(), timeZone?: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((entry) => entry.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

/** Server-side "today" for schedules, completions and notifications. */
export function appToday(now = new Date()): string {
  return calendarDay(now, APP_TIME_ZONE);
}

/**
 * Upper bound for "not in the future" checks. A rider east of Brasília can be
 * on a later day than the server's home zone; their today is still valid.
 */
export function latestCalendarDay(now = new Date()): string {
  return calendarDay(now, EARLIEST_TIME_ZONE);
}
