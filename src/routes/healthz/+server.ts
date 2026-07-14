import { json } from "@sveltejs/kit";
import { createSupabaseAdminClient } from "$server/supabase/admin";

export async function GET({ platform }) {
  try {
    const { error } = await createSupabaseAdminClient(platform)
      .from("site_settings")
      .select("id")
      .limit(1);
    if (error) return json({ status: "error" }, { status: 503 });
    return json({ status: "ok" });
  } catch {
    return json({ status: "error" }, { status: 503 });
  }
}
