import { fail } from "@sveltejs/kit";
import { f as featureActions, l as loadFeature } from "../../../../chunks/crud.js";
const base = featureActions("tires");
const v = (f, k) => String(f.get(k) ?? "").trim();
const actions = { ...base, saveProduct: async ({ request, locals }) => {
  const f = await request.formData();
  const { error } = await locals.supabase.from("tire_products").insert({ owner_id: locals.user.id, manufacturer: v(f, "manufacturer"), model_name: v(f, "model_name"), tire_type: v(f, "tire_type") || "street", price_cents: Math.round(Number(f.get("price") ?? 0) * 100) });
  return error ? fail(400, { message: error.message }) : { ok: true };
}, savePressure: async ({ request, locals }) => {
  const f = await request.formData();
  const { error } = await locals.supabase.from("tire_pressure_records").insert({ owner_id: locals.user.id, motorcycle_id: v(f, "motorcycle_id"), date: v(f, "date"), psi_front: Number(f.get("psi_front")), psi_rear: Number(f.get("psi_rear")), notes: v(f, "notes") });
  return error ? fail(400, { message: error.message }) : { ok: true };
} };
async function load({ locals }) {
  const baseData = await loadFeature(locals.supabase, "tires", locals.user);
  const [products, pressures] = await Promise.all([locals.supabase.from("tire_products").select("*").eq("owner_id", locals.user.id), locals.supabase.from("tire_pressure_records").select("*").eq("owner_id", locals.user.id).order("date", { ascending: false })]);
  return { ...baseData, products: products.data ?? [], pressures: pressures.data ?? [] };
}
export {
  actions,
  load
};
