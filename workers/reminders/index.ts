import { createClient } from "@supabase/supabase-js";
import { evaluateReminder } from "../../src/lib/server/domain/reminders";

export interface Env {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  EMAIL_FUNCTION_URL: string;
  EMAIL_FUNCTION_TOKEN: string;
}

export default {
  async scheduled(_event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(processReminders(env));
  },
  async fetch(_request: Request, env: Env) {
    const result = await processReminders(env);
    return Response.json(result);
  },
};

async function processReminders(env: Env) {
  const supabase = createClient(
    env.SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: { persistSession: false, autoRefreshToken: false },
    },
  );
  const today = new Date().toISOString().slice(0, 10);
  const { data: reminders, error } = await supabase
    .from("reminders")
    .select("*, motorcycles(current_odometer_km, name), profiles(email)")
    .eq("is_active", true);
  if (error) throw error;

  let due = 0;
  let emailed = 0;
  for (const reminder of reminders ?? []) {
    const evaluation = evaluateReminder(reminder, {
      currentOdometerKm: Number(reminder.motorcycles?.current_odometer_km ?? 0),
      today,
    });
    if (evaluation.status !== "overdue" && evaluation.status !== "due_soon")
      continue;
    due += 1;

    if (
      reminder.send_email &&
      !reminder.last_email_notified_at &&
      reminder.profiles?.email
    ) {
      const response = await fetch(env.EMAIL_FUNCTION_URL, {
        method: "POST",
        headers: {
          authorization: `Bearer ${env.EMAIL_FUNCTION_TOKEN}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          to: reminder.profiles.email,
          subject: `Moto Track: ${reminder.title}`,
          text: `${reminder.motorcycles?.name ?? "Moto"}: ${reminder.title}\nStatus: ${evaluation.status}`,
        }),
      });
      if (response.ok) {
        emailed += 1;
        await supabase
          .from("reminders")
          .update({
            last_notified_at: new Date().toISOString(),
            last_email_notified_at: new Date().toISOString(),
          })
          .eq("id", reminder.id);
      }
    }
  }

  return { due, emailed };
}
