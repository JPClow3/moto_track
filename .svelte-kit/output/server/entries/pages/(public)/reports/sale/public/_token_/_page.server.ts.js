import { error } from "@sveltejs/kit";
import { c as createSupabaseAdminClient } from "../../../../../../../chunks/admin.js";
import { s as shareTokenHash } from "../../../../../../../chunks/sale-report-share.js";
async function load({ params, platform }) {
  const supabase = createSupabaseAdminClient(platform);
  const tokenHash = await shareTokenHash(params.token);
  const { data: share } = await supabase.from("sale_report_shares").select("*, motorcycles(*)").eq("token_hash", tokenHash).is("revoked_at", null).gte("expires_at", (/* @__PURE__ */ new Date()).toISOString()).maybeSingle();
  if (!share) throw error(404, "Public report not found");
  const row = share;
  await supabase.from("sale_report_shares").update({
    access_count: Number(row.access_count ?? 0) + 1,
    last_accessed_at: (/* @__PURE__ */ new Date()).toISOString()
  }).eq("id", String(row.id));
  return { share: row };
}
export {
  load
};
