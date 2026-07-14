import { error, json } from "@sveltejs/kit";
import { n as normalizeTheme } from "../../../../chunks/parity.js";
async function POST({ request, locals }) {
  if (!locals.user) throw error(401, "Authentication required.");
  const body = await request.json().catch(() => null);
  const theme = normalizeTheme(body?.theme);
  if (!theme) throw error(400, "Invalid theme.");
  const { error: updateError } = await locals.supabase.from("profiles").update({ theme }).eq("id", locals.user.id);
  if (updateError) throw error(400, "Unable to save theme.");
  return json({ theme });
}
export {
  POST
};
