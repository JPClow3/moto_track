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
  try {
    const [row] = await locals.db<Array<{ is_staff: boolean }>>`
      select is_staff from profiles where id = ${locals.user.id}
    `;
    return Boolean(row?.is_staff);
  } catch {
    // Matches the old Supabase-error path: a failed lookup reads as "not staff"
    // rather than surfacing a 500 on every page just to show/hide a nav item.
    return false;
  }
}
