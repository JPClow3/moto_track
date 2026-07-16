import { createClient } from "@supabase/supabase-js";
import { evaluateReminder } from "../../src/lib/server/domain/reminders";

export interface Env {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  EMAIL_FUNCTION_URL: string;
  EMAIL_FUNCTION_TOKEN: string;
  REMINDERS_TRIGGER_TOKEN: string;
}

export default {
  async scheduled(_event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(processReminders(env));
  },
  // Manual trigger for testing the cron path. It sends real email and writes to
  // the database, so it stays closed unless REMINDERS_TRIGGER_TOKEN is set.
  async fetch(request: Request, env: Env) {
    if (!env.REMINDERS_TRIGGER_TOKEN) {
      return new Response("Not found", { status: 404 });
    }
    if (
      request.headers.get("authorization") !==
      `Bearer ${env.REMINDERS_TRIGGER_TOKEN}`
    ) {
      return new Response("Unauthorized", { status: 401 });
    }
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
    .select("*, motorcycles(current_odometer_km, name)")
    .eq("is_active", true);
  if (error) throw error;

  const ownerIds = [...new Set((reminders ?? []).map((row) => row.owner_id))];
  const { data: profiles, error: profileError } = ownerIds.length
    ? await supabase.from("profiles").select("id, email").in("id", ownerIds)
    : { data: [], error: null };
  if (profileError) throw profileError;
  const emailByOwner = new Map(
    (profiles ?? []).map((profile) => [profile.id, profile.email]),
  );

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
      emailByOwner.get(reminder.owner_id)
    ) {
      const response = await fetch(env.EMAIL_FUNCTION_URL, {
        method: "POST",
        headers: {
          authorization: `Bearer ${env.EMAIL_FUNCTION_TOKEN}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          to: emailByOwner.get(reminder.owner_id),
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
