/**
 * Single source of truth for "is this user staff?".
 *
 * The admin page kept its own copy of this query while the sidebar hardcoded an
 * Admin link for everyone, so non-staff users saw a nav item that only ever led
 * to a rejection notice. The nav and the page now read the same answer.
 *
 * This gates *visibility* only. Every admin action re-checks server-side, so a
 * user who types /admin directly still gets nothing.
 *
 * Privilege lockdown (app-layer, Neon has no RLS/service_role): `is_staff`
 * has no user-facing write path anywhere in this codebase — grep confirms it
 * is only ever selected, never inserted/updated by a route or action. The old
 * Supabase migration enforced this with a trigger that allowed the change only
 * when `auth.role() = 'service_role'`; Neon has no such role (every query,
 * including this one, runs through the same app DB connection), so a trigger
 * here couldn't distinguish "the app" from "a trusted operator using the Neon
 * SQL console" and would end up blocking the only legitimate way to grant
 * staff access. The invariant is therefore enforced by never adding a write
 * path in application code — promote/demote staff by running SQL directly
 * against Neon. Keep it that way; do not add an is_staff field to any form,
 * action, or API payload.
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
