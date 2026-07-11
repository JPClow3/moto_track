export type OdometerSource = {
  odometer_km?: number | null;
  installed_odometer_km?: number | null;
  odometer_end_km?: number | null;
};

export function recomputeOdometer({
  overrideKm,
  fuel,
  maintenance,
  tires,
  work = [],
}: {
  overrideKm?: number | null;
  fuel: OdometerSource[];
  maintenance: OdometerSource[];
  tires: OdometerSource[];
  work?: OdometerSource[];
}) {
  const values = [
    overrideKm ?? 0,
    ...fuel.map((row) => row.odometer_km ?? 0),
    ...maintenance.map((row) => row.odometer_km ?? 0),
    ...tires.map((row) => row.installed_odometer_km ?? 0),
    ...work.map((row) => row.odometer_end_km ?? 0),
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

export async function syncMotorcycleOdometer(
  supabase: SupabaseClient<Database>,
  ownerId: string,
  motorcycleId: string,
) {
  const [
    motorcycleResult,
    fuelResult,
    maintenanceResult,
    tireResult,
    workResult,
  ] = await Promise.all([
    supabase
      .from("motorcycles")
      .select("odometer_override_km")
      .eq("id", motorcycleId)
      .eq("owner_id", ownerId)
      .maybeSingle(),
    supabase
      .from("fuel_records")
      .select("odometer_km")
      .eq("motorcycle_id", motorcycleId)
      .eq("owner_id", ownerId),
    supabase
      .from("maintenance_records")
      .select("odometer_km")
      .eq("motorcycle_id", motorcycleId)
      .eq("owner_id", ownerId),
    supabase
      .from("tire_records")
      .select("installed_odometer_km")
      .eq("motorcycle_id", motorcycleId)
      .eq("owner_id", ownerId),
    supabase
      .from("work_sessions")
      .select("odometer_end_km")
      .eq("motorcycle_id", motorcycleId)
      .eq("owner_id", ownerId),
  ]);
  if (!motorcycleResult.data) return;

  const currentOdometerKm = recomputeOdometer({
    overrideKm: motorcycleResult.data.odometer_override_km,
    fuel: fuelResult.data ?? [],
    maintenance: maintenanceResult.data ?? [],
    tires: tireResult.data ?? [],
    work: workResult.data ?? [],
  });
  await supabase
    .from("motorcycles")
    .update({
      current_odometer_km: currentOdometerKm,
      current_odometer_updated_at: new Date().toISOString(),
    })
    .eq("id", motorcycleId)
    .eq("owner_id", ownerId);
}
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "$lib/types/database";
