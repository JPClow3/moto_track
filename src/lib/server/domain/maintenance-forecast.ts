import { isoDateValue } from "./date-value";

export type OdometerSample = { date: unknown; odometer_km: number };
const DAY_MS = 86_400_000;

export function validDate(value: unknown): string | null {
  const date = isoDateValue(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const parsed = new Date(`${date}T00:00:00Z`);
  return Number.isFinite(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === date
    ? date
    : null;
}

export function addCalendarDays(date: string, days: number): string | null {
  if (!validDate(date) || !Number.isFinite(days)) return null;
  const time =
    new Date(`${date}T00:00:00Z`).getTime() + Math.ceil(days) * DAY_MS;
  const result = new Date(time);
  return Number.isFinite(time) && result.getUTCFullYear() <= 9999
    ? result.toISOString().slice(0, 10)
    : null;
}

/** Recent, observed pace. Rollbacks and stale readings cannot support a forecast. */
export function estimateDailyDistance(
  samples: OdometerSample[],
  today: string,
): number | null {
  if (!validDate(today)) return null;
  const cutoff = addCalendarDays(today, -90)!;
  const byDay = new Map<string, number>();
  for (const sample of samples) {
    const date = validDate(sample.date);
    const km = sample.odometer_km;
    if (
      !date ||
      date > today ||
      date < cutoff ||
      !Number.isFinite(km) ||
      km < 0
    )
      continue;
    byDay.set(date, Math.max(byDay.get(date) ?? 0, km));
  }
  const readings = [...byDay].sort(([a], [b]) => a.localeCompare(b));
  if (readings.length < 2) return null;
  const first = readings[0];
  const latest = readings[readings.length - 1];
  if (latest[0] < addCalendarDays(today, -30)!) return null;
  if (readings.some((reading, i) => i > 0 && reading[1] < readings[i - 1][1]))
    return null;
  const days = (Date.parse(latest[0]) - Date.parse(first[0])) / DAY_MS;
  const pace = (latest[1] - first[1]) / days;
  return Number.isFinite(pace) && pace > 0 ? pace : null;
}

export function forecastDateAtKm(
  dueKm: number,
  currentKm: number,
  kmPerDay: number | null,
  today: string,
) {
  if (
    !Number.isFinite(dueKm) ||
    !Number.isFinite(currentKm) ||
    currentKm < 0 ||
    !validDate(today)
  )
    return null;
  if (dueKm <= currentKm) return today;
  return kmPerDay !== null && Number.isFinite(kmPerDay) && kmPerDay > 0
    ? addCalendarDays(today, (dueKm - currentKm) / kmPerDay)
    : null;
}

export function forecastMaintenance({
  lastService,
  intervalKm,
  intervalDays,
  currentKm,
  odometerSamples,
  today,
}: {
  lastService: { date: unknown; odometer_km: number | null } | null;
  intervalKm: number | null;
  intervalDays: number | null;
  currentKm: number;
  odometerSamples: OdometerSample[];
  today: string;
}) {
  if (!lastService || !validDate(today)) return null;
  const serviceDate = validDate(lastService.date);
  const serviceKm = lastService.odometer_km;
  if (serviceDate && serviceDate > today) return null;
  const kmPerDay = estimateDailyDistance(odometerSamples, today);
  const dueKm =
    intervalKm !== null &&
    Number.isFinite(intervalKm) &&
    intervalKm > 0 &&
    serviceKm !== null &&
    Number.isFinite(serviceKm) &&
    serviceKm >= 0
      ? serviceKm + intervalKm
      : null;
  const dueByDate =
    serviceDate &&
    intervalDays !== null &&
    Number.isInteger(intervalDays) &&
    intervalDays > 0
      ? addCalendarDays(serviceDate, intervalDays)
      : null;
  const predictedDateByKm =
    dueKm === null ? null : forecastDateAtKm(dueKm, currentKm, kmPerDay, today);
  const dates = [dueByDate, predictedDateByKm].filter(
    (date): date is string => date !== null,
  );
  return {
    dueKm,
    dueDate: dates.sort()[0] ?? null,
    kmPerDay,
    dueByDate,
    predictedDateByKm,
  };
}
