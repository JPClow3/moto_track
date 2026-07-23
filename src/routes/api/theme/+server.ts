import { error, json } from "@sveltejs/kit";
import { normalizeTheme } from "$server/domain/parity";

export async function POST({ request, locals }) {
  if (!locals.user) throw error(401, "Authentication required.");
  const body = await request.json().catch(() => null);
  const theme = normalizeTheme(body?.theme);
  if (!theme) throw error(400, "Invalid theme.");
  try {
    await locals.db`
      update profiles set theme = ${theme} where id = ${locals.user.id}
    `;
  } catch {
    throw error(400, "Unable to save theme.");
  }
  return json({ theme });
}
