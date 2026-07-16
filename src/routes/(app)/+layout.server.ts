import { isStaffUser } from "$server/domain/staff";

export async function load({ locals, url }) {
  return {
    user: locals.user,
    currentPath: url.pathname,
    // Drives whether the Admin item renders at all. Not a security boundary —
    // see the note in $server/domain/staff.
    isStaff: await isStaffUser(locals),
  };
}
