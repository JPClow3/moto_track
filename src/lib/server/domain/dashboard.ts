import type { FuelRecord } from "./fuel";

export type SpendEvent = { date: string; amountCents: number };

export type ConsumptionPoint = { date: string; kmPerLiter: number };

/** Keyed rather than labelled: the caller supplies the wording for its locale. */
export type CostCategory = "fuel" | "maintenance" | "tires" | "fees";
export type CostSlice = { key: CostCategory; cents: number };

export type ActivityCell = { date: string; count: number };

const DAY_MS = 24 * 60 * 60 * 1000;

function byDateThenOdometer(a: FuelRecord, b: FuelRecord) {
  return a.date.localeCompare(b.date) || a.odometer_km - b.odometer_km;
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
          date: ordered[i].date,
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
    const key = event.date.slice(0, 7);
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
  dates: string[],
  { today, weeks = 18 }: { today: string; weeks?: number },
): ActivityCell[] {
  const counts = new Map<string, number>();
  for (const date of dates) {
    if (!date) continue;
    const day = date.slice(0, 10);
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
