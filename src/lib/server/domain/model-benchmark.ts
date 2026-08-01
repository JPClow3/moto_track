import type { FuelRecord } from "./fuel";

/**
 * A cohort result is intentionally withheld until five different accounts
 * have contributed. The account-level dedupe table enforces one row per
 * account/model pair; keeping this value in one place prevents the SQL and UI
 * from drifting apart.
 */
export const BENCHMARK_MIN_SAMPLE_SIZE = 5;

/** Hard bounds keep malformed or obviously poisoned values out of a cohort. */
export const BENCHMARK_CONSUMPTION_RANGE = { min: 1, max: 100 } as const;
export const BENCHMARK_MAINTENANCE_RANGE = { min: 0, max: 1_000_000 } as const;

export type BenchmarkPosition =
  "sem comparação" | "acima da média" | "abaixo da média" | "na média";

export type BenchmarkRawMaintenance = {
  date?: string | null;
  odometer_km?: number | string | null;
  cost_cents?: number | string | null;
};

export type ComparableBenchmarkMetrics = {
  /** Average of valid full-tank intervals, in km/L. */
  consumptionKmL: number | null;
  /** Maintenance cost normalized to the recorded distance, per 1,000 km. */
  maintenanceCentsPer1000Km: number | null;
  consumptionIntervals: number;
  maintenanceRecords: number;
  distanceKm: number | null;
};

function finiteNumber(value: unknown) {
  if (value === null || value === undefined) return null;
  if (typeof value === "string" && value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function round(value: number, decimals: number) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

/**
 * Returns a stable lookup key rather than display text. Casing and accent
 * folding are pinned to pt-BR so every reader produces the same key even when
 * their browser locale differs. Incomplete identities intentionally return an
 * empty key and cannot enter a cohort.
 */
export function modelBenchmarkKey(brand: string, model: string, year: number) {
  if (
    !String(brand ?? "").trim() ||
    !String(model ?? "").trim() ||
    !Number.isInteger(Number(year)) ||
    Number(year) <= 1900
  ) {
    return "";
  }

  const normalized = [brand, model, year].map((value) =>
    String(value)
      .trim()
      .toLocaleLowerCase("pt-BR")
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, ""),
  );
  return normalized.every(Boolean) ? normalized.join(":") : "";
}

/** A model can only be benchmarked when all three identity fields are known. */
export function hasCompleteModelIdentity(
  brand: unknown,
  model: unknown,
  year: unknown,
) {
  return Boolean(
    modelBenchmarkKey(String(brand ?? ""), String(model ?? ""), Number(year)),
  );
}

/**
 * Normalizes a metric before it reaches SQL. Returning null for anything
 * outside the defensible range is safer than clipping a bad value to a bound,
 * which could still bias a small cohort.
 */
export function normalizeBenchmarkMetric(
  value: unknown,
  range: { min: number; max: number },
  decimals = 2,
) {
  const parsed = finiteNumber(value);
  if (parsed === null || parsed < range.min || parsed > range.max) return null;
  return round(parsed, decimals);
}

function validFuelRecords(records: FuelRecord[]) {
  return records.filter((record) => {
    const date = String(record.date ?? "");
    const odometer = finiteNumber(record.odometer_km);
    const liters = finiteNumber(record.liters);
    return (
      /^\d{4}-\d{2}-\d{2}/.test(date) &&
      odometer !== null &&
      odometer >= 0 &&
      liters !== null &&
      liters > 0
    );
  });
}

function consumptionSummary(records: FuelRecord[]) {
  const ordered = [...records].sort(
    (a, b) =>
      String(a.date).localeCompare(String(b.date)) ||
      Number(a.odometer_km) - Number(b.odometer_km),
  );
  let previousFull = -1;
  let totalDistance = 0;
  let totalLiters = 0;
  let intervals = 0;

  for (let i = 0; i < ordered.length; i += 1) {
    if (!ordered[i].tank_full) continue;
    if (previousFull >= 0) {
      const distance =
        Number(ordered[i].odometer_km) -
        Number(ordered[previousFull].odometer_km);
      const liters = ordered
        .slice(previousFull + 1, i + 1)
        .reduce((sum, record) => sum + Number(record.liters), 0);
      // Invalid intervals are discarded rather than allowed to poison the
      // weighted average. The current full tank becomes the next baseline.
      if (distance > 0 && liters > 0) {
        totalDistance += distance;
        totalLiters += liters;
        intervals += 1;
      }
    }
    previousFull = i;
  }

  return {
    value:
      intervals > 0 && totalLiters > 0 ? totalDistance / totalLiters : null,
    intervals,
  };
}

/**
 * Calculates metrics that can be compared across riders:
 *
 * - consumption is the average of valid full-tank intervals (the same
 *   methodology as the dashboard), and is unavailable until one interval
 *   exists;
 * - maintenance is total recorded maintenance spend divided by the monotonic
 *   odometer distance represented in the rider's records, expressed per 1,000
 *   km. A lifetime total is deliberately never submitted because riders have
 *   very different history lengths.
 */
export function comparableBenchmarkMetrics(
  fuelRecords: FuelRecord[],
  maintenanceRecords: BenchmarkRawMaintenance[],
): ComparableBenchmarkMetrics {
  const validFuel = validFuelRecords(fuelRecords);
  const consumption = consumptionSummary(validFuel);
  const consumptionKmL = normalizeBenchmarkMetric(
    consumption.value,
    BENCHMARK_CONSUMPTION_RANGE,
    2,
  );

  const validMaintenance = maintenanceRecords.filter((record) => {
    const date = String(record.date ?? "");
    const odometer = finiteNumber(record.odometer_km);
    const cost = finiteNumber(record.cost_cents);
    return (
      /^\d{4}-\d{2}-\d{2}/.test(date) &&
      odometer !== null &&
      odometer >= 0 &&
      cost !== null &&
      cost >= 0
    );
  });

  // Fuel and maintenance odometers are both event readings. Sort the merged
  // timeline, reject any rollback, and use only the represented distance.
  const anchors = [
    ...validFuel.map((record) => ({
      date: String(record.date),
      odometer: Number(record.odometer_km),
    })),
    ...validMaintenance.map((record) => ({
      date: String(record.date),
      odometer: Number(record.odometer_km),
    })),
  ].sort((a, b) => a.date.localeCompare(b.date) || a.odometer - b.odometer);

  let distanceKm: number | null = null;
  if (anchors.length >= 2) {
    let distance = 0;
    let previous = anchors[0].odometer;
    let rollback = false;
    for (const anchor of anchors.slice(1)) {
      if (anchor.odometer < previous) {
        rollback = true;
        break;
      }
      distance += anchor.odometer - previous;
      previous = anchor.odometer;
    }
    if (!rollback && distance > 0) distanceKm = distance;
  }

  const maintenanceTotalCents = validMaintenance.reduce(
    (sum, record) => sum + Number(record.cost_cents),
    0,
  );
  const maintenanceCentsPer1000Km =
    distanceKm !== null && validMaintenance.length > 0
      ? normalizeBenchmarkMetric(
          (maintenanceTotalCents / distanceKm) * 1000,
          BENCHMARK_MAINTENANCE_RANGE,
          0,
        )
      : null;

  return {
    consumptionKmL,
    maintenanceCentsPer1000Km,
    consumptionIntervals: consumption.intervals,
    maintenanceRecords: validMaintenance.length,
    distanceKm,
  };
}

/** A contribution with at least one trustworthy, normalized metric. */
export function hasComparableBenchmarkMetric(
  metrics: ComparableBenchmarkMetrics,
) {
  return (
    metrics.consumptionKmL !== null ||
    metrics.maintenanceCentsPer1000Km !== null
  );
}

/**
 * A comparison is only meaningful at the k-anonymity floor. The 10% band is
 * intentionally inclusive at both boundaries: exactly ±10% is "na média".
 */
export function benchmarkPosition(
  value: number,
  average: number,
  sampleSize = BENCHMARK_MIN_SAMPLE_SIZE,
): BenchmarkPosition {
  if (
    sampleSize < BENCHMARK_MIN_SAMPLE_SIZE ||
    !Number.isFinite(value) ||
    !Number.isFinite(average) ||
    average <= 0
  ) {
    return "sem comparação";
  }
  const difference = (value - average) / average;
  if (difference > 0.1) return "acima da média";
  if (difference < -0.1) return "abaixo da média";
  return "na média";
}

export type BenchmarkComparison = {
  sampleSize: number;
  available: boolean;
  average: number | null;
  position: BenchmarkPosition;
  differencePercent: number | null;
};

export function compareBenchmarkMetric(
  value: number | null,
  average: number | null,
  sampleSize: number,
): BenchmarkComparison {
  const available =
    sampleSize >= BENCHMARK_MIN_SAMPLE_SIZE &&
    value !== null &&
    average !== null &&
    Number.isFinite(value) &&
    Number.isFinite(average) &&
    average > 0;
  const differencePercent = available
    ? round(((value! - average!) / average!) * 100, 1)
    : null;
  return {
    sampleSize,
    available,
    average: available ? average : null,
    position: available
      ? benchmarkPosition(value!, average!, sampleSize)
      : "sem comparação",
    differencePercent,
  };
}
