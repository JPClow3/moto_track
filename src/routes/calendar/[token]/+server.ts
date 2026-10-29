import { error } from "@sveltejs/kit";
import type { Locale } from "$lib/i18n";
import { exportMessages } from "$lib/i18n/exports";
import { shareTokenHash } from "$server/domain/sale-report-share";
import {
  calendarResponse,
  loadReminderCalendar,
} from "$server/domain/reminder-calendar";

export async function GET({ locals, params }) {
  const token = params.token.replace(/\.ics$/, "");
  const notFound = exportMessages("pt-BR").calendarNotFound;
  if (!/^[a-f0-9]{64}$/.test(token)) throw error(404, notFound);
  const hash = await shareTokenHash(token);
  const [feed] = await locals.db<Array<{ owner_id: string; locale: Locale }>>`
    select owner_id, locale from calendar_feeds
    where token_hash = ${hash} and revoked_at is null and expires_at > now()
  `;
  if (!feed) throw error(404, notFound);
  // A crawler's Accept-Language must not change the owner's published feed.
  return calendarResponse(
    await loadReminderCalendar(locals.db, feed.owner_id, feed.locale),
    false,
    feed.locale,
  );
}
