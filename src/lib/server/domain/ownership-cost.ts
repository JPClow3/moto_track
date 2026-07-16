export function calculateOwnershipCost({
  purchaseCents,
  fuelCents,
  maintenanceCents,
  tireCents,
  feeCents,
  depreciationCents = 0,
  currentKm,
}: {
  purchaseCents: number;
  fuelCents: number;
  maintenanceCents: number;
  tireCents: number;
  feeCents: number;
  depreciationCents?: number;
  currentKm: number;
}) {
  const totalCents =
    purchaseCents +
    fuelCents +
    maintenanceCents +
    tireCents +
    feeCents +
    depreciationCents;
  return {
    totalCents,
    costPerKmCents: currentKm > 0 ? Math.round(totalCents / currentKm) : null,
  };
}
