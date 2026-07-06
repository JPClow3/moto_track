export type FuelRecord = {
  date: string;
  odometer_km: number;
  liters: number;
  total_price_cents?: number | null;
  tank_full?: boolean | null;
};

export function averageConsumption(records: FuelRecord[]) {
  const ordered = [...records].sort(
    (a, b) => a.date.localeCompare(b.date) || a.odometer_km - b.odometer_km,
  );
  const full = ordered.filter((record) => record.tank_full);
  if (full.length < 2) return null;
  const first = full[0];
  const last = full[full.length - 1];
  const liters = full
    .slice(1)
    .reduce((sum, record) => sum + Number(record.liters || 0), 0);
  const distance = last.odometer_km - first.odometer_km;
  if (distance <= 0 || liters <= 0) return null;
  return Math.round((distance / liters) * 10) / 10;
}

export function costPerKm(records: FuelRecord[]) {
  const ordered = [...records].sort((a, b) => a.odometer_km - b.odometer_km);
  if (ordered.length < 2) return null;
  const distance =
    ordered[ordered.length - 1].odometer_km - ordered[0].odometer_km;
  const total = ordered.reduce(
    (sum, record) => sum + Number(record.total_price_cents || 0),
    0,
  );
  if (distance <= 0) return null;
  return Math.round((total / 100 / distance) * 1000) / 1000;
}
