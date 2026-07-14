export type ThemePreference = "system" | "light" | "dark";

export type TimelineEvent = {
  source: string;
  date: string;
  label: string;
  amountCents: number;
};

export type TimelineFilters = {
  source?: string;
  start?: string;
  end?: string;
};

export function archiveMotorcycle(at = new Date().toISOString()) {
  return { is_active: false, deleted_at: at };
}

export function restoreMotorcycle() {
  return { is_active: true, deleted_at: null };
}

export function normalizeTheme(value: unknown): ThemePreference | null {
  return value === "system" || value === "light" || value === "dark"
    ? value
    : null;
}

export function buildTimeline(
  events: TimelineEvent[],
  filters: TimelineFilters = {},
) {
  return events
    .filter((event) => !filters.source || event.source === filters.source)
    .filter((event) => !filters.start || event.date >= filters.start)
    .filter((event) => !filters.end || event.date <= filters.end)
    .sort((left, right) => right.date.localeCompare(left.date));
}

export function calculateWorkProfitability({
  distanceKm,
  grossIncomeCents,
  tipsCents,
  fuelSpentCents,
  fixedDailyCostCents,
  maintenanceReservePerKmMillicents,
  depreciationPerKmMillicents,
}: {
  distanceKm: number;
  grossIncomeCents: number;
  tipsCents: number;
  fuelSpentCents: number;
  fixedDailyCostCents: number;
  maintenanceReservePerKmMillicents: number;
  depreciationPerKmMillicents: number;
}) {
  const variableCostCents = Math.round(
    (Math.max(distanceKm, 0) *
      (maintenanceReservePerKmMillicents + depreciationPerKmMillicents)) /
      1000,
  );
  const revenueCents = grossIncomeCents + tipsCents;
  const costCents = fuelSpentCents + fixedDailyCostCents + variableCostCents;
  return { revenueCents, costCents, profitCents: revenueCents - costCents };
}
