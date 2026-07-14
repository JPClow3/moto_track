import { fail } from "@sveltejs/kit";
import { f as featureActions, l as loadFeature } from "../../../../chunks/crud.js";
const base = featureActions("maintenance");
const v = (f, k) => String(f.get(k) ?? "").trim();
const actions = { ...base, savePart: async ({ request, locals }) => {
  const f = await request.formData();
  const { error } = await locals.supabase.from("maintenance_parts").insert({ owner_id: locals.user.id, name: v(f, "name"), manufacturer: v(f, "manufacturer"), part_type: v(f, "part_type") || "other", price_cents: Math.round(Number(f.get("price") ?? 0) * 100), track_stock: f.get("track_stock") === "true", stock_quantity: Number(f.get("stock_quantity") ?? 0) });
  return error ? fail(400, { message: error.message }) : { ok: true };
}, savePlan: async ({ request, locals }) => {
  const f = await request.formData();
  const motorcycleId = v(f, "motorcycle_id");
  const type = v(f, "maintenance_type");
  const { data: plan, error } = await locals.supabase.from("maintenance_plan_items").upsert({ owner_id: locals.user.id, motorcycle_id: motorcycleId, maintenance_type: type, interval_km: Number(f.get("interval_km")) || null, interval_days: Number(f.get("interval_days")) || null, is_active: true }).select().single();
  if (error || !plan) return fail(400, { message: error?.message ?? "Plano inválido." });
  await locals.supabase.from("reminders").insert({ owner_id: locals.user.id, motorcycle_id: motorcycleId, title: `Plano: ${type}`, trigger_type: Number(f.get("interval_km")) ? "by_interval" : "by_date", trigger_value_km: Number(f.get("interval_km")) || null, trigger_value_days: Number(f.get("interval_days")) || null, is_active: true, linked_plan_item_id: plan.id });
  return { ok: true };
} };
async function load({ locals }) {
  const baseData = await loadFeature(locals.supabase, "maintenance", locals.user);
  const [parts, plans, photos] = await Promise.all([locals.supabase.from("maintenance_parts").select("*").eq("owner_id", locals.user.id), locals.supabase.from("maintenance_plan_items").select("*").eq("owner_id", locals.user.id), locals.supabase.from("maintenance_photos").select("*").eq("owner_id", locals.user.id)]);
  return { ...baseData, parts: parts.data ?? [], plans: plans.data ?? [], photos: photos.data ?? [] };
}
export {
  actions,
  load
};
