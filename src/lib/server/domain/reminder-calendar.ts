import type { Sql } from "postgres";
import type { Locale } from "$lib/i18n";
import { exportMessages } from "$lib/i18n/exports";
import {
  addCalendarDays,
  estimateDailyDistance,
  forecastDateAtKm,
  validDate,
} from "./maintenance-forecast";
import { loadOdometerHistory } from "./odometer-history";

export type CalendarReminder = {
  id: string;
  title: string;
  motorcycle_name: string | null;
  motorcycle_id: string | null;
  current_odometer_km: number | null;
  trigger_type: string;
  reference_date: unknown;
  reference_km: number | null;
  trigger_value_days: number | null;
  trigger_value_km: number | null;
  snoozed_until_date?: unknown;
  snoozed_until_km?: number | null;
};

function text(value: string) {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\r\n|\r|\n/g, "\\n")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,");
}

// RFC 5545 limits content lines to 75 UTF-8 octets, including continuation space.
function fold(line: string) {
  const encoder = new TextEncoder();
  let result = "";
  let bytes = 0;
  for (const char of line) {
    const size = encoder.encode(char).length;
    if (bytes + size > 75) {
      result += "\r\n ";
      bytes = 1;
    }
    result += char;
    bytes += size;
  }
  return result;
}

export function buildReminderCalendar(
  reminders: Array<CalendarReminder & { km_per_day?: number | null }>,
  now = new Date(),
  locale: Locale = "pt-BR",
) {
  const copy = exportMessages(locale);
  const today = now.toISOString().slice(0, 10);
  const stamp = now
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "");
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    `PRODID:-//Moto Track//Reminders//${locale === "en" ? "EN" : "PT-BR"}`,
    "CALSCALE:GREGORIAN",
    "X-WR-CALNAME:Moto Track",
  ];
  for (const reminder of reminders) {
    const dates: string[] = [];
    const referenceDate = validDate(reminder.reference_date);
    if (
      ["by_date", "by_interval"].includes(reminder.trigger_type) &&
      referenceDate &&
      reminder.trigger_value_days !== null &&
      Number.isInteger(reminder.trigger_value_days) &&
      reminder.trigger_value_days >= 0
    ) {
      const date = addCalendarDays(referenceDate, reminder.trigger_value_days);
      if (date) dates.push(date);
    }
    let predicted: string | null = null;
    if (
      ["by_km", "by_interval"].includes(reminder.trigger_type) &&
      reminder.reference_km !== null &&
      reminder.trigger_value_km !== null &&
      reminder.current_odometer_km !== null &&
      reminder.reference_km >= 0 &&
      reminder.trigger_value_km >= 0
    ) {
      predicted = forecastDateAtKm(
        Number(reminder.reference_km) + Number(reminder.trigger_value_km),
        Number(reminder.current_odometer_km),
        reminder.km_per_day ?? null,
        today,
      );
      if (predicted) dates.push(predicted);
    }
    let due = dates.sort()[0];
    const dateGate = validDate(reminder.snoozed_until_date);
    const kmGate = reminder.snoozed_until_km;
    if (
      kmGate !== null &&
      kmGate !== undefined &&
      reminder.current_odometer_km === null
    )
      continue;
    if (
      kmGate !== null &&
      kmGate !== undefined &&
      reminder.current_odometer_km !== null &&
      kmGate > reminder.current_odometer_km
    ) {
      const gateDate = forecastDateAtKm(
        kmGate,
        reminder.current_odometer_km,
        reminder.km_per_day ?? null,
        today,
      );
      // A mileage snooze gates every trigger axis; no pace means no honest date.
      if (!gateDate) continue;
      if (due && gateDate > due) due = gateDate;
    }
    if (due && dateGate && dateGate > due) due = dateGate;
    if (!due || !/^[a-zA-Z0-9-]+$/.test(reminder.id)) continue;
    const end = addCalendarDays(due, 1);
    if (!end) continue;
    const description =
      predicted === due
        ? copy.calendarMileageDescription
        : copy.calendarDateDescription;
    lines.push(
      "BEGIN:VEVENT",
      `UID:reminder-${reminder.id}@moto-track.net`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${due.replaceAll("-", "")}`,
      `DTEND;VALUE=DATE:${end.replaceAll("-", "")}`,
      `SUMMARY:${text(reminder.motorcycle_name ? `${reminder.motorcycle_name}: ${reminder.title}` : reminder.title)}`,
      `DESCRIPTION:${text(description)}`,
      "CLASS:PRIVATE",
      "TRANSP:TRANSPARENT",
      "END:VEVENT",
    );
  }
  lines.push("END:VCALENDAR");
  return lines.map(fold).join("\r\n") + "\r\n";
}

export async function loadReminderCalendar(
  db: Sql,
  ownerId: string,
  locale: Locale,
) {
  const [reminders, history] = await Promise.all([
    db<CalendarReminder[]>`
      select r.id, r.title, r.motorcycle_id, r.trigger_type, r.reference_date::text,
        r.reference_km, r.trigger_value_days, r.trigger_value_km,
        r.snoozed_until_date::text, r.snoozed_until_km,
        m.name as motorcycle_name, m.current_odometer_km
      from reminders r
      left join motorcycles m on m.id = r.motorcycle_id and m.owner_id = ${ownerId}
      where r.owner_id = ${ownerId} and r.is_active = true
        and (r.motorcycle_id is null or (m.is_active = true and m.deleted_at is null))
      order by r.id
    `,
    loadOdometerHistory(db, ownerId),
  ]);
  const today = new Date().toISOString().slice(0, 10);
  return buildReminderCalendar(
    reminders.map((r) => ({
      ...r,
      km_per_day: estimateDailyDistance(
        history.get(r.motorcycle_id ?? "") ?? [],
        today,
      ),
    })),
    new Date(),
    locale,
  );
}

export function calendarResponse(
  body: string,
  download = false,
  locale: Locale = "pt-BR",
) {
  return new Response(body, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Language": locale,
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename="moto-track.ics"`,
      "Cache-Control": "private, no-store",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}
