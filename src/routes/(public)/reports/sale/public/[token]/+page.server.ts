import { error } from "@sveltejs/kit";

export async function load({ locals, params }) {
  const prefix = params.token.slice(0, 12);
  const { data: share } = await locals.supabase
    .from("sale_report_shares")
    .select("*, motorcycles(*)")
    .eq("token_prefix", prefix)
    .is("revoked_at", null)
    .maybeSingle();
  if (!share) throw error(404, "Public report not found");
  const row = share as Record<string, unknown>;
  await locals.supabase
    .from("sale_report_shares")
    .update({
      access_count: Number(row.access_count ?? 0) + 1,
      last_accessed_at: new Date().toISOString(),
    })
    .eq("id", String(row.id));
  return { share: row };
}
