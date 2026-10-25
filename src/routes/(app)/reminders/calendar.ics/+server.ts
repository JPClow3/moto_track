import { error } from "@sveltejs/kit";
import { exportMessages } from "$lib/i18n/exports";
import {
  calendarResponse,
  loadReminderCalendar,
} from "$server/domain/reminder-calendar";

export async function GET({ locals }) {
  if (!locals.user)
    throw error(401, exportMessages(locals.locale).authenticationRequired);
  return calendarResponse(
    await loadReminderCalendar(locals.db, locals.user.id, locals.locale),
    true,
    locals.locale,
  );
}
