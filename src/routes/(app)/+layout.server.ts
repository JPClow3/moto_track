import { redirect } from "@sveltejs/kit";
import { isStaffUser } from "$server/domain/staff";

/**
 * Remembers which bike the shell, the dashboard and quick-log default to.
 * Pages read the resolved id via `(await parent()).activeMotorcycleId` (which
 * also makes them re-run when it changes) rather than this cookie directly.
 */
const ACTIVE_BIKE_COOKIE = "mt_active_bike";

export type ShellMotorcycle = {
  id: string;
  name: string;
  brand: string;
  model: string;
  year: number | null;
  current_odometer_km: number | null;
};

export async function load({ locals, url, cookies }) {
  const user = locals.user;

  // Owner-scoped, non-archived bikes for the bike switcher. Same order as the
  // dashboard (`order by name`), so with no stored choice both agree on which
  // bike comes first. A failed lookup degrades to "no switcher", never a 500.
  const [motorcycles, isStaff] = await Promise.all([
    user
      ? locals.db<ShellMotorcycle[]>`
          select id, name, brand, model, year, current_odometer_km
          from motorcycles
          where owner_id = ${user.id} and is_active = true and deleted_at is null
          order by name
        `.catch(() => [] as ShellMotorcycle[])
      : Promise.resolve([] as ShellMotorcycle[]),
    isStaffUser(locals),
  ]);
  const ownsBike = (id: string | null | undefined) =>
    Boolean(id) && motorcycles.some((moto) => String(moto.id) === id);

  // The switcher is a GET form (`?bike=<id>`), so it works without JS and
  // needs no extra endpoint. Only a bike this owner holds is accepted; the
  // choice is stored in a cookie and the param is dropped from the URL.
  const requested = url.searchParams.get("bike");
  if (requested !== null) {
    if (ownsBike(requested)) {
      cookies.set(ACTIVE_BIKE_COOKIE, requested, {
        path: "/",
        httpOnly: true,
        sameSite: "lax",
        maxAge: 60 * 60 * 24 * 365,
      });
    }
    const clean = new URL(url);
    clean.searchParams.delete("bike");
    throw redirect(303, clean.pathname + clean.search);
  }

  const stored = cookies.get(ACTIVE_BIKE_COOKIE);
  const activeMotorcycle =
    motorcycles.find((moto) => String(moto.id) === stored) ??
    motorcycles[0] ??
    null;

  return {
    user,
    // Drives whether the Admin item renders at all. Not a security boundary —
    // see the note in $server/domain/staff.
    isStaff,
    motorcycles,
    activeMotorcycleId: activeMotorcycle ? String(activeMotorcycle.id) : null,
  };
}
