export function estimateTireLife({
  installedKm,
  currentKm,
  wearPercent,
  observedKm = currentKm,
}: {
  installedKm: number;
  currentKm: number;
  wearPercent: number;
  observedKm?: number;
}) {
  const distance = observedKm - installedKm;
  if (
    !Number.isFinite(installedKm) ||
    !Number.isFinite(currentKm) ||
    !Number.isFinite(observedKm) ||
    !Number.isFinite(wearPercent) ||
    installedKm < 0 ||
    distance < 0 ||
    observedKm > currentKm ||
    wearPercent <= 0 ||
    wearPercent > 100
  )
    return null;
  if (wearPercent === 100)
    return { projectedChangeKm: observedKm, remainingKm: 0 };
  if (distance === 0) return null;
  const projectedChangeKm = Math.round(
    installedKm + (distance / wearPercent) * 100,
  );
  return {
    projectedChangeKm,
    remainingKm: Math.max(projectedChangeKm - currentKm, 0),
  };
}
