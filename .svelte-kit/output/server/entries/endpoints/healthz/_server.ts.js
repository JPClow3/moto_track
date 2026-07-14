import { json } from "@sveltejs/kit";
import { c as createSupabaseAdminClient } from "../../../chunks/admin.js";
async function GET({ platform }) {
  try {
    const { error } = await createSupabaseAdminClient(platform).from("site_settings").select("id").limit(1);
    if (error) return json({ status: "error" }, { status: 503 });
    return json({ status: "ok" });
  } catch {
    return json({ status: "error" }, { status: 503 });
  }
}
export {
  GET
};
