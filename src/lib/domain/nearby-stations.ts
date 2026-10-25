export type Station = {
  id: string;
  name: string;
  latitude?: unknown;
  longitude?: unknown;
};
export type StationFill = {
  station_id?: unknown;
  date?: unknown;
  fuel_type?: unknown;
  fuel_grade_id?: unknown;
  price_per_liter_millicents?: unknown;
  total_price_cents?: unknown;
  liters?: unknown;
};

export function coordinate(value: unknown, limit: number): number | null {
  if (
    (typeof value !== "number" && typeof value !== "string") ||
    String(value).trim() === ""
  )
    return null;
  const number = Number(value);
  return Number.isFinite(number) && Math.abs(number) <= limit ? number : null;
}

export function distanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
) {
  const radians = Math.PI / 180;
  const a =
    Math.sin(((lat2 - lat1) * radians) / 2) ** 2 +
    Math.cos(lat1 * radians) *
      Math.cos(lat2 * radians) *
      Math.sin(((lon2 - lon1) * radians) / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(Math.min(1, Math.max(0, a))));
}

/** Compare only the rider's latest observation for the selected fuel, never old minima. */
export function nearbyStations(
  stations: Station[],
  records: StationFill[],
  options: {
    latitude: number;
    longitude: number;
    radiusKm: number;
    fuelType: string;
    fuelGradeId?: string | null;
    today: string;
  },
) {
  if (
    coordinate(options.latitude, 90) === null ||
    coordinate(options.longitude, 180) === null ||
    !Number.isFinite(options.radiusKm) ||
    options.radiusKm <= 0
  )
    return [];
  const latest = new Map<string, { date: string; price: number }>();
  const cutoff =
    new Date(`${options.today}T00:00:00Z`).getTime() - 30 * 86_400_000;
  for (const record of records) {
    if (
      String(record.fuel_type ?? "") !== options.fuelType ||
      String(record.fuel_grade_id ?? "") !==
        String(options.fuelGradeId ?? "") ||
      !record.station_id
    )
      continue;
    const date =
      record.date instanceof Date
        ? record.date.toISOString().slice(0, 10)
        : String(record.date ?? "").slice(0, 10);
    const time = Date.parse(`${date}T00:00:00Z`);
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
      !Number.isFinite(time) ||
      time < cutoff ||
      date > options.today
    )
      continue;
    const liters = Number(record.liters);
    const total = Number(record.total_price_cents);
    const price =
      Number(record.price_per_liter_millicents) ||
      (liters > 0 && total > 0 ? (total / liters) * 1000 : 0);
    if (!Number.isFinite(price) || price <= 0) continue;
    const id = String(record.station_id);
    // On the same day retain the more expensive observation rather than promise a historical low.
    const previous = latest.get(id);
    if (
      !previous ||
      date > previous.date ||
      (date === previous.date && price > previous.price)
    )
      latest.set(id, { date, price });
  }
  return stations
    .flatMap((station) => {
      const latitude = coordinate(station.latitude, 90);
      const longitude = coordinate(station.longitude, 180);
      const observation = latest.get(station.id);
      if (latitude === null || longitude === null || !observation) return [];
      const distance = distanceKm(
        options.latitude,
        options.longitude,
        latitude,
        longitude,
      );
      return distance <= options.radiusKm
        ? [
            {
              ...station,
              latitude,
              longitude,
              distanceKm: distance,
              observedDate: observation.date,
              priceMillicents: Math.round(observation.price),
            },
          ]
        : [];
    })
    .sort(
      (a, b) =>
        a.priceMillicents - b.priceMillicents || a.distanceKm - b.distanceKm,
    );
}
