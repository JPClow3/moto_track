import { featureActions, loadFeature } from "$server/domain/crud";
export const actions = featureActions("reports");
export async function load({ locals }) {
  const featureData = await loadFeature(
    locals.supabase,
    "reports",
    locals.user!,
  );
  const [
    { data: fuel },
    { data: maintenance },
    { data: tires },
    { data: expenses },
  ] = await Promise.all([
    locals.supabase
      .from("fuel_records")
      .select("total_price_cents")
      .eq("owner_id", locals.user!.id),
    locals.supabase
      .from("maintenance_records")
      .select("cost_cents")
      .eq("owner_id", locals.user!.id),
    locals.supabase
      .from("tire_records")
      .select("cost_cents")
      .eq("owner_id", locals.user!.id),
    locals.supabase
      .from("annual_fees")
      .select("amount_cents")
      .eq("owner_id", locals.user!.id),
  ]);
  return {
    ...featureData,
    totals: {
      fuel: (fuel ?? []).reduce(
        (sum, row) => sum + Number(row.total_price_cents || 0),
        0,
      ),
      maintenance: (maintenance ?? []).reduce(
        (sum, row) => sum + Number(row.cost_cents || 0),
        0,
      ),
      tires: (tires ?? []).reduce(
        (sum, row) => sum + Number(row.cost_cents || 0),
        0,
      ),
      expenses: (expenses ?? []).reduce(
        (sum, row) => sum + Number(row.amount_cents || 0),
        0,
      ),
    },
  };
}
