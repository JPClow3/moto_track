import { redirect } from "@sveltejs/kit";

export async function GET({ url, locals }) {
  const code = url.searchParams.get("code");
  if (code) {
    await locals.supabase.auth.exchangeCodeForSession(code);
  }
  throw redirect(303, url.searchParams.get("next") ?? "/dashboard");
}
