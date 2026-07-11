import { featureActions, loadFeature } from "$server/domain/crud";
import { siteUrl } from "$server/env";

const baseActions = featureActions("reports");

export const actions = {
  ...baseActions,
  createShare: async ({ request, locals, platform }) => {
    const form = await request.formData();
    const motorcycleId = String(form.get("motorcycle_id") ?? "");
    const days = Math.max(Number(form.get("days") ?? 14), 1);
    const token =
      crypto.randomUUID().replaceAll("-", "") +
      crypto.randomUUID().replaceAll("-", "");
    const expires = new Date();
    expires.setDate(expires.getDate() + days);
    const { error } = await locals.supabase.from("sale_report_shares").insert({
      owner_id: locals.user!.id,
      motorcycle_id: motorcycleId,
      token_prefix: token.slice(0, 12),
      expires_at: expires.toISOString(),
    });
    if (error) return { ok: false, message: error.message };
    return {
      ok: true,
      publicUrl: `${siteUrl(platform)}/reports/sale/public/${token}`,
    };
  },
  revokeShare: async ({ request, locals }) => {
    const form = await request.formData();
    const { error } = await locals.supabase
      .from("sale_report_shares")
      .update({ revoked_at: new Date().toISOString() })
      .eq("id", String(form.get("id") ?? ""))
      .eq("owner_id", locals.user!.id);
    return error ? { ok: false, message: error.message } : { ok: true };
  },
};

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
    { data: motorcycles },
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
    locals.supabase
      .from("motorcycles")
      .select("id, name, brand, model, year")
      .eq("owner_id", locals.user!.id)
      .eq("is_active", true)
      .order("name"),
  ]);
  return {
    ...featureData,
    motorcycles: motorcycles ?? [],
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
