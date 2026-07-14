function recomputeOdometer({
  overrideKm,
  fuel,
  maintenance,
  tires,
  work = []
}) {
  const values = [
    overrideKm ?? 0,
    ...fuel.map((row) => row.odometer_km ?? 0),
    ...maintenance.map((row) => row.odometer_km ?? 0),
    ...tires.map((row) => row.installed_odometer_km ?? 0),
    ...work.map((row) => row.odometer_end_km ?? 0)
  ];
  return Math.max(0, ...values.map((value) => Number(value) || 0));
}
async function syncMotorcycleOdometer(supabase, ownerId, motorcycleId) {
  const [
    motorcycleResult,
    fuelResult,
    maintenanceResult,
    tireResult,
    workResult
  ] = await Promise.all([
    supabase.from("motorcycles").select("odometer_override_km").eq("id", motorcycleId).eq("owner_id", ownerId).maybeSingle(),
    supabase.from("fuel_records").select("odometer_km").eq("motorcycle_id", motorcycleId).eq("owner_id", ownerId),
    supabase.from("maintenance_records").select("odometer_km").eq("motorcycle_id", motorcycleId).eq("owner_id", ownerId),
    supabase.from("tire_records").select("installed_odometer_km").eq("motorcycle_id", motorcycleId).eq("owner_id", ownerId),
    supabase.from("work_sessions").select("odometer_end_km").eq("motorcycle_id", motorcycleId).eq("owner_id", ownerId)
  ]);
  if (!motorcycleResult.data) return;
  const currentOdometerKm = recomputeOdometer({
    overrideKm: motorcycleResult.data.odometer_override_km,
    fuel: fuelResult.data ?? [],
    maintenance: maintenanceResult.data ?? [],
    tires: tireResult.data ?? [],
    work: workResult.data ?? []
  });
  await supabase.from("motorcycles").update({
    current_odometer_km: currentOdometerKm,
    current_odometer_updated_at: (/* @__PURE__ */ new Date()).toISOString()
  }).eq("id", motorcycleId).eq("owner_id", ownerId);
}
export {
  syncMotorcycleOdometer as s
};
