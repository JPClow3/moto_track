import { redirect } from "@sveltejs/kit";
import { appToday } from "$lib/utils/calendar-day";
import {
  groupTimelineByMonth,
  loadTimeline,
  nextBefore,
  parseCalendarDay,
  parseTimelineFilter,
  timelineWindow,
} from "$server/domain/timeline";

/**
 * The (app) layout consumes `?bike=` itself (it sets the shell's active bike
 * and redirects the param away), so this page's own bike filter is `?moto=`:
 * a bike id or `all`. Without it the timeline follows the active bike.
 */
export async function load({ locals, url, parent }) {
  // /history may not be in the hooks' protected prefixes; never read
  // `locals.user!` without a session.
  if (!locals.user) {
    throw redirect(
      303,
      `/auth?redirectTo=${encodeURIComponent(url.pathname + url.search)}`,
    );
  }
  const ownerId = locals.user.id;
  const filter = parseTimelineFilter(url.searchParams.get("type"));
  const before = parseCalendarDay(url.searchParams.get("before"));
  const today = appToday();

  // Owner-scoped, non-archived bikes and the active one, resolved by the
  // layout. Only ids from this list are ever used as a filter.
  const { motorcycles, activeMotorcycleId } = await parent();
  const owned = (id: string | null | undefined) =>
    Boolean(id) && motorcycles.some((moto) => String(moto.id) === id);

  // With one bike (or none) there is nothing to choose, and scoping to it would
  // hide records that were never linked to a bike.
  const requested = url.searchParams.get("moto") ?? "";
  let bike = "all";
  if (motorcycles.length > 1 && requested !== "all") {
    if (owned(requested)) bike = requested;
    else if (owned(activeMotorcycleId)) bike = String(activeMotorcycleId);
    else bike = String(motorcycles[0].id);
  }

  const range = timelineWindow(before, today);
  const { entries, olderDay, failed } = await loadTimeline(locals.db, {
    ownerId,
    motorcycleId: bike === "all" ? null : bike,
    filter,
    start: range.start,
    end: range.end,
    today,
  });

  return {
    filter,
    bike,
    before,
    nextBefore: nextBefore(olderDay),
    months: groupTimelineByMonth(entries),
    loadFailed: failed,
  };
}
