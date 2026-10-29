import type { FuelRecord } from "./fuel";
import { isoDateValue } from "./date-value";

export type SpendEvent = { date: string | Date; amountCents: number };

export type ConsumptionPoint = { date: string; kmPerLiter: number };

/** Keyed rather than labelled: the caller supplies the wording for its locale. */
export type CostCategory = "fuel" | "maintenance" | "tires" | "fees";
export type CostSlice = { key: CostCategory; cents: number };

export type ActivityCell = { date: string; count: number };

const DAY_MS = 24 * 60 * 60 * 1000;

function byDateThenOdometer(a: FuelRecord, b: FuelRecord) {
  return (
    isoDateValue(a.date).localeCompare(isoDateValue(b.date)) ||
    a.odometer_km - b.odometer_km
  );
}

/**
 * km/L for each full-tank-to-full-tank interval, oldest first.
 *
 * Uses the same methodology as averageConsumption(): distance between two full
 * tanks divided by every litre put in *after* the first one. Partial fills in
 * between are folded into the interval they belong to rather than dropped.
 */
export function consumptionTrend(
  records: FuelRecord[],
  limit = 12,
): ConsumptionPoint[] {
  const ordered = [...records].sort(byDateThenOdometer);
  const points: ConsumptionPoint[] = [];
  let previousFull = -1;

  for (let i = 0; i < ordered.length; i++) {
    if (!ordered[i].tank_full) continue;
    if (previousFull >= 0) {
      const distance =
        ordered[i].odometer_km - ordered[previousFull].odometer_km;
      const liters = ordered
        .slice(previousFull + 1, i + 1)
        .reduce((sum, record) => sum + Number(record.liters || 0), 0);
      if (distance > 0 && liters > 0) {
        points.push({
          date: isoDateValue(ordered[i].date),
          kmPerLiter: Math.round((distance / liters) * 10) / 10,
        });
      }
    }
    previousFull = i;
  }

  return points.slice(-limit);
}

/** Total spend per calendar month, oldest first, including empty months. */
export function spendByMonth(
  events: SpendEvent[],
  { today, months = 6 }: { today: string; months?: number },
): Array<{ month: string; cents: number }> {
  const end = new Date(`${today}T00:00:00.000Z`);
  const buckets = new Map<string, number>();

  for (let i = months - 1; i >= 0; i--) {
    const cursor = new Date(end);
    cursor.setUTCDate(1);
    cursor.setUTCMonth(cursor.getUTCMonth() - i);
    buckets.set(cursor.toISOString().slice(0, 7), 0);
  }

  for (const event of events) {
    if (!event.date) continue;
    const key = isoDateValue(event.date).slice(0, 7);
    // Only months inside the window exist as buckets; anything older is ignored.
    if (!buckets.has(key)) continue;
    buckets.set(key, (buckets.get(key) ?? 0) + Math.max(event.amountCents, 0));
  }

  return [...buckets].map(([month, cents]) => ({ month, cents }));
}

/** Spend totals per category, largest first, zero-value slices dropped. */
export function costBreakdown(sources: {
  fuel: number;
  maintenance: number;
  tires: number;
  fees: number;
}): CostSlice[] {
  return (
    [
      { key: "fuel", cents: sources.fuel },
      { key: "maintenance", cents: sources.maintenance },
      { key: "tires", cents: sources.tires },
      { key: "fees", cents: sources.fees },
    ] satisfies CostSlice[]
  )
    .filter((slice) => slice.cents > 0)
    .sort((a, b) => b.cents - a.cents);
}

/**
 * One cell per day for the trailing `weeks`, aligned so each column is a full
 * Monday-to-Sunday week and the last column contains today.
 */
export function activityCalendar(
  dates: Array<string | Date>,
  { today, weeks = 18 }: { today: string; weeks?: number },
): ActivityCell[] {
  const counts = new Map<string, number>();
  for (const date of dates) {
    if (!date) continue;
    const day = isoDateValue(date);
    counts.set(day, (counts.get(day) ?? 0) + 1);
  }

  const end = new Date(`${today}T00:00:00.000Z`);
  // Advance to Sunday so the final column is a complete week.
  end.setUTCDate(end.getUTCDate() + ((7 - end.getUTCDay()) % 7));
  const start = new Date(end.getTime() - (weeks * 7 - 1) * DAY_MS);

  const cells: ActivityCell[] = [];
  for (let time = start.getTime(); time <= end.getTime(); time += DAY_MS) {
    const day = new Date(time).toISOString().slice(0, 10);
    cells.push({ date: day, count: counts.get(day) ?? 0 });
  }
  return cells;
}

export type OdometerReading = { date: string | Date; odometerKm: number };

export type WindowCostPerKm = {
  cents: number;
  distanceKm: number;
  centsPerKm: number;
};

function shiftDays(day: string, delta: number) {
  const date = new Date(`${day}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + delta);
  return date.toISOString().slice(0, 10);
}

/**
 * What riding cost per km over the trailing `days`, ending today.
 *
 * Spend is every event dated inside the window. Distance runs from the last
 * odometer reading before the window (when it is recent enough to bound the
 * window, at most `days` earlier) or else the first reading inside it, to the
 * highest reading inside it. Returns null when the window has no measurable
 * distance, so a quiet month shows "no data" instead of a divide-by-zero.
 */
export function costPerKmWindow({
  spend,
  readings,
  today,
  days = 30,
}: {
  spend: SpendEvent[];
  readings: OdometerReading[];
  today: string;
  days?: number;
}): WindowCostPerKm | null {
  const start = shiftDays(today, -days);
  const oldestBaseline = shiftDays(start, -days);

  const dated = readings
    .filter((reading) => reading.date && Number.isFinite(reading.odometerKm))
    .map((reading) => ({
      day: isoDateValue(reading.date),
      km: Number(reading.odometerKm),
    }))
    // 0 km is a real reading (a new bike's baseline); only reject negatives.
    .filter((reading) => reading.km >= 0 && reading.day <= today);

  const inside = dated.filter((reading) => reading.day > start);
  if (!inside.length) return null;

  const before = dated
    .filter((reading) => reading.day <= start && reading.day >= oldestBaseline)
    .sort((a, b) => b.day.localeCompare(a.day) || b.km - a.km)[0];
  const end = Math.max(...inside.map((reading) => reading.km));
  const baseline = before
    ? before.km
    : Math.min(...inside.map((reading) => reading.km));
  const distanceKm = end - baseline;
  if (distanceKm <= 0) return null;

  const cents = spend.reduce((sum, event) => {
    if (!event.date) return sum;
    const day = isoDateValue(event.date);
    if (day <= start || day > today) return sum;
    return sum + Math.max(Number(event.amountCents) || 0, 0);
  }, 0);

  return {
    cents,
    distanceKm,
    centsPerKm: Math.round((cents / distanceKm) * 100) / 100,
  };
}
