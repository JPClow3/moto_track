function archiveMotorcycle(at = (/* @__PURE__ */ new Date()).toISOString()) {
  return { is_active: false, deleted_at: at };
}
function restoreMotorcycle() {
  return { is_active: true, deleted_at: null };
}
function normalizeTheme(value) {
  return value === "system" || value === "light" || value === "dark" ? value : null;
}
function buildTimeline(events, filters = {}) {
  return events.filter((event) => !filters.source || event.source === filters.source).filter((event) => !filters.start || event.date >= filters.start).filter((event) => !filters.end || event.date <= filters.end).sort((left, right) => right.date.localeCompare(left.date));
}
function calculateWorkProfitability({
  distanceKm,
  grossIncomeCents,
  tipsCents,
  fuelSpentCents,
  fixedDailyCostCents,
  maintenanceReservePerKmMillicents,
  depreciationPerKmMillicents
}) {
  const variableCostCents = Math.round(
    Math.max(distanceKm, 0) * (maintenanceReservePerKmMillicents + depreciationPerKmMillicents) / 1e3
  );
  const revenueCents = grossIncomeCents + tipsCents;
  const costCents = fuelSpentCents + fixedDailyCostCents + variableCostCents;
  return { revenueCents, costCents, profitCents: revenueCents - costCents };
}
export {
  archiveMotorcycle as a,
  buildTimeline as b,
  calculateWorkProfitability as c,
  normalizeTheme as n,
  restoreMotorcycle as r
};
