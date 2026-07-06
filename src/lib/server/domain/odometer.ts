export type OdometerSource = {
  odometer_km?: number | null;
  installed_odometer_km?: number | null;
};

export function recomputeOdometer({
  overrideKm,
  fuel,
  maintenance,
  tires,
}: {
  overrideKm?: number | null;
  fuel: OdometerSource[];
  maintenance: OdometerSource[];
  tires: OdometerSource[];
}) {
  const values = [
    overrideKm ?? 0,
    ...fuel.map((row) => row.odometer_km ?? 0),
    ...maintenance.map((row) => row.odometer_km ?? 0),
    ...tires.map((row) => row.installed_odometer_km ?? 0),
  ];
  return Math.max(0, ...values.map((value) => Number(value) || 0));
}

export function validateOdometer(candidate: number, current: number) {
  if (!Number.isFinite(candidate) || candidate < 0)
    return "O odômetro deve ser positivo.";
  if (current > 0 && candidate < current)
    return "O odômetro não pode retroceder.";
  return null;
}
