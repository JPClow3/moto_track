type ServiceRecord = { date: string; odometer_km: number };
type OdometerSample = { date: string; odometer_km: number };

function dayDifference(start: string, end: string) {
  return Math.max(
    0,
    (new Date(`${end}T00:00:00Z`).getTime() -
      new Date(`${start}T00:00:00Z`).getTime()) /
      86_400_000,
  );
}

function addDays(date: string, days: number) {
  const result = new Date(`${date}T00:00:00Z`);
  result.setUTCDate(result.getUTCDate() + Math.ceil(days));
  return result.toISOString().slice(0, 10);
}

export function forecastMaintenance({
  lastService,
  intervalKm,
  intervalDays,
  currentKm,
  odometerSamples,
  today,
}: {
  lastService: ServiceRecord | null;
  intervalKm: number | null;
  intervalDays: number | null;
  currentKm: number;
  odometerSamples: OdometerSample[];
  today: string;
}) {
  if (!lastService) return null;
  const dates = [...odometerSamples, lastService].sort(
    (a, b) => a.date.localeCompare(b.date) || a.odometer_km - b.odometer_km,
  );
  const first = dates[0];
  const latest = dates[dates.length - 1];
  const days = first ? dayDifference(first.date, latest.date) : 0;
  const kmPerDay =
    days > 0
      ? Math.max(0, (latest.odometer_km - first.odometer_km) / days)
      : null;
  const dueByKm =
    intervalKm === null ? null : lastService.odometer_km + intervalKm;
  const dueByDate =
    intervalDays === null ? null : addDays(lastService.date, intervalDays);
  const predictedDateByKm =
    dueByKm !== null && kmPerDay && kmPerDay > 0
      ? addDays(today, Math.max(0, (dueByKm - currentKm) / kmPerDay))
      : null;
  const datesToCompare = [dueByDate, predictedDateByKm].filter(
    (date): date is string => Boolean(date),
  );
  return {
    dueKm: dueByKm,
    dueDate: datesToCompare.sort()[0] ?? null,
    kmPerDay,
  };
}
