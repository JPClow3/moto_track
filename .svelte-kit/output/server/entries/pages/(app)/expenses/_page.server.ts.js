import { fail } from "@sveltejs/kit";
import { f as featureActions, l as loadFeature } from "../../../../chunks/crud.js";
const base = featureActions("expenses");
const v = (f, k) => String(f.get(k) ?? "").trim();
const actions = {
  ...base,
  savePolicy: async ({ request, locals }) => {
    const f = await request.formData();
    const id = v(f, "id") || crypto.randomUUID();
    const payload = { id, owner_id: locals.user.id, motorcycle_id: v(f, "motorcycle_id"), provider: v(f, "provider"), policy_number: v(f, "policy_number"), coverage_start: v(f, "coverage_start"), coverage_end: v(f, "coverage_end"), premium_cents: Math.round(Number(f.get("premium") ?? 0) * 100), notify_before_days: Number(f.get("notify_before_days") ?? 30), notes: v(f, "notes") };
    const { error } = await locals.supabase.from("insurance_policies").upsert(payload);
    if (error) return fail(400, { message: error.message });
    const reminder = { owner_id: locals.user.id, motorcycle_id: payload.motorcycle_id, title: `Seguro: ${payload.provider}`, trigger_type: "by_date", trigger_value_days: payload.notify_before_days, reference_date: payload.coverage_end, is_active: true, send_email: true, send_push: true, notes: `insurance:${id}` };
    await locals.supabase.from("reminders").upsert(reminder, { onConflict: "owner_id,title" });
    return { ok: true };
  },
  saveClaim: async ({ request, locals }) => {
    const f = await request.formData();
    const policyId = v(f, "policy_id");
    const { data: policy } = await locals.supabase.from("insurance_policies").select("id").eq("id", policyId).eq("owner_id", locals.user.id).maybeSingle();
    if (!policy) return fail(404, { message: "Seguro não encontrado." });
    const { error } = await locals.supabase.from("insurance_claims").insert({ owner_id: locals.user.id, policy_id: policyId, claim_date: v(f, "claim_date"), description: v(f, "description"), amount_cents: Math.round(Number(f.get("amount") ?? 0) * 100), status: v(f, "status") || "open" });
    return error ? fail(400, { message: error.message }) : { ok: true };
  },
  deletePolicy: async ({ request, locals }) => {
    const f = await request.formData();
    const { error } = await locals.supabase.from("insurance_policies").delete().eq("id", v(f, "id")).eq("owner_id", locals.user.id);
    return error ? fail(400, { message: error.message }) : { ok: true };
  }
};
async function load({ locals }) {
  const baseData = await loadFeature(locals.supabase, "expenses", locals.user);
  const [policies, claims] = await Promise.all([locals.supabase.from("insurance_policies").select("*").eq("owner_id", locals.user.id).order("coverage_end"), locals.supabase.from("insurance_claims").select("*").eq("owner_id", locals.user.id).order("claim_date", { ascending: false })]);
  return { ...baseData, policies: policies.data ?? [], claims: claims.data ?? [] };
}
export {
  actions,
  load
};
