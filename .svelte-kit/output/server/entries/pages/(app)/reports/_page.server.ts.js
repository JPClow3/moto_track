import { fail } from "@sveltejs/kit";
import { s as shareTokenHash } from "../../../../chunks/sale-report-share.js";
import { s as siteUrl } from "../../../../chunks/env.js";
import { b as buildTimeline } from "../../../../chunks/parity.js";
const actions = {
  createShare: async ({ request, locals, platform }) => {
    const form = await request.formData();
    const motorcycleId = String(form.get("motorcycle_id") ?? "");
    const days = Math.max(Number(form.get("days") ?? 14), 1);
    const { data: motorcycle } = await locals.supabase.from("motorcycles").select("id").eq("id", motorcycleId).eq("owner_id", locals.user.id).eq("is_active", true).maybeSingle();
    if (!motorcycle) return fail(404, { message: "Moto não encontrada." });
    const token = `${crypto.randomUUID().replaceAll("-", "")}${crypto.randomUUID().replaceAll("-", "")}`;
    const expiresAt = /* @__PURE__ */ new Date();
    expiresAt.setDate(expiresAt.getDate() + days);
    const { error } = await locals.supabase.from("sale_report_shares").insert({ owner_id: locals.user.id, motorcycle_id: motorcycleId, token_prefix: token.slice(0, 12), token_hash: await shareTokenHash(token), expires_at: expiresAt.toISOString() });
    return error ? fail(400, { message: error.message }) : { publicUrl: `${siteUrl(platform)}/reports/sale/public/${token}` };
  },
  revokeShare: async ({ request, locals }) => {
    const form = await request.formData();
    const { error } = await locals.supabase.from("sale_report_shares").update({ revoked_at: (/* @__PURE__ */ new Date()).toISOString() }).eq("id", String(form.get("id") ?? "")).eq("owner_id", locals.user.id);
    return error ? fail(400, { message: error.message }) : { ok: true };
  }
};
async function load({ locals, url }) {
  const ownerId = locals.user.id;
  const [fuel, maintenance, tires, fees, work, motorcycles, shares] = await Promise.all([
    locals.supabase.from("fuel_records").select("date, total_price_cents, station_name").eq("owner_id", ownerId),
    locals.supabase.from("maintenance_records").select("date, cost_cents, maintenance_type").eq("owner_id", ownerId),
    locals.supabase.from("tire_records").select("installed_at, cost_cents, brand_model").eq("owner_id", ownerId),
    locals.supabase.from("annual_fees").select("due_date, amount_cents, fee_type").eq("owner_id", ownerId),
    locals.supabase.from("work_sessions").select("work_date, gross_income_cents, platform_source").eq("owner_id", ownerId),
    locals.supabase.from("motorcycles").select("id, name, brand, model, year").eq("owner_id", ownerId).eq("is_active", true).order("name"),
    locals.supabase.from("sale_report_shares").select("id, token_prefix, expires_at, revoked_at, access_count, motorcycle_id").eq("owner_id", ownerId).order("created_at", { ascending: false })
  ]);
  const events = [
    ...(fuel.data ?? []).map((row) => ({ source: "fuel", date: row.date, label: row.station_name || "Abastecimento", amountCents: Number(row.total_price_cents) })),
    ...(maintenance.data ?? []).map((row) => ({ source: "maintenance", date: row.date, label: row.maintenance_type, amountCents: Number(row.cost_cents) })),
    ...(tires.data ?? []).map((row) => ({ source: "tires", date: row.installed_at, label: row.brand_model, amountCents: Number(row.cost_cents) })),
    ...(fees.data ?? []).map((row) => ({ source: "expenses", date: row.due_date, label: row.fee_type, amountCents: Number(row.amount_cents) })),
    ...(work.data ?? []).map((row) => ({ source: "work", date: row.work_date, label: row.platform_source, amountCents: -Number(row.gross_income_cents) }))
  ];
  const timeline = buildTimeline(events, { source: url.searchParams.get("source") || void 0, start: url.searchParams.get("start") || void 0, end: url.searchParams.get("end") || void 0 });
  return { motorcycles: motorcycles.data ?? [], shares: shares.data ?? [], timeline: timeline.slice(0, 100), filters: { source: url.searchParams.get("source") ?? "", start: url.searchParams.get("start") ?? "", end: url.searchParams.get("end") ?? "" } };
}
export {
  actions,
  load
};
