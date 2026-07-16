export function estimateTireLife({
  installedKm,
  currentKm,
  wearPercent,
}: {
  installedKm: number;
  currentKm: number;
  wearPercent: number;
}) {
  const distance = currentKm - installedKm;
  if (
    !Number.isFinite(distance) ||
    !Number.isFinite(wearPercent) ||
    distance < 0 ||
    wearPercent <= 0 ||
    wearPercent >= 100
  )
    return null;
  const projectedChangeKm = Math.round(
    installedKm + (distance / wearPercent) * 100,
  );
  return {
    projectedChangeKm,
    remainingKm: Math.max(projectedChangeKm - currentKm, 0),
  };
}
