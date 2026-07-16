/**
 * Single source of truth for "is this user staff?".
 *
 * The admin page kept its own copy of this query while the sidebar hardcoded an
 * Admin link for everyone, so non-staff users saw a nav item that only ever led
 * to a rejection notice. The nav and the page now read the same answer.
 *
 * This gates *visibility* only. Every admin action re-checks server-side, and
 * the tables are additionally protected by RLS — a user who types /admin
 * directly still gets nothing.
 */
export async function isStaffUser(locals: App.Locals): Promise<boolean> {
  if (!locals.user) return false;
  const { data } = await locals.supabase
    .from("profiles")
    .select("is_staff")
    .eq("id", locals.user.id)
    .maybeSingle();
  return Boolean(data?.is_staff);
}
