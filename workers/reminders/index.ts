import postgres from "postgres";
import { evaluateReminder } from "../../src/lib/server/domain/reminders";
import {
  decryptPushField,
  isAllowedPushEndpoint,
} from "../../src/lib/server/domain/push-crypto";
import { sendWebPush, type WebPushConfig } from "./web-push";

export interface Env {
  HYPERDRIVE: Hyperdrive;
  RESEND_API_KEY: string;
  DEFAULT_FROM_EMAIL: string;
  REMINDERS_TRIGGER_TOKEN: string;
  PUBLIC_VAPID_KEY?: string;
  VAPID_PRIVATE_KEY?: string;
  PUSH_ENCRYPTION_KEY?: string;
  VAPID_SUBJECT?: string;
}

type ReminderRow = {
  id: string;
  owner_id: string;
  title: string;
  trigger_type: "by_km" | "by_date" | "by_interval";
  trigger_value_km: number | null;
  trigger_value_days: number | null;
  reference_km: number | null;
  reference_date: string | null;
  send_email: boolean;
  send_push: boolean;
  last_email_notified_at: string | null;
  last_push_notified_at: string | null;
  current_odometer_km: number | null;
  motorcycle_name: string | null;
  owner_email: string | null;
};

type PushSubscriptionRow = {
  id: string;
  owner_id: string;
  endpoint_encrypted: string;
  p256dh_encrypted: string;
  auth_encrypted: string;
};

export default {
  async scheduled(_event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(processReminders(env));
  },
  // Manual trigger for testing the cron path. It sends real email/push and
  // writes to the database, so it stays closed unless REMINDERS_TRIGGER_TOKEN
  // is set.
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

function webPushConfig(env: Env): WebPushConfig | null {
  if (!env.PUBLIC_VAPID_KEY || !env.VAPID_PRIVATE_KEY) return null;
  return {
    publicKey: env.PUBLIC_VAPID_KEY,
    privateKey: env.VAPID_PRIVATE_KEY,
    subject: env.VAPID_SUBJECT || "mailto:ops@mototrack.app",
  };
}

// prepare:false + max:1 are required through Hyperdrive's transaction pooler,
// same as the app's own db client (src/lib/server/db/client.ts).
export async function processReminders(env: Env) {
  const sql = postgres(env.HYPERDRIVE.connectionString, {
    prepare: false,
    max: 1,
  });

  try {
    const today = new Date().toISOString().slice(0, 10);
    // Single owner-scoped join replaces the old two-step Supabase reads
    // (reminders + profiles embed); is_active already scopes to live reminders.
    const rows = await sql<ReminderRow[]>`
      select r.*, m.current_odometer_km, m.name as motorcycle_name,
        p.email as owner_email
      from reminders r
      left join motorcycles m on m.id = r.motorcycle_id
      left join profiles p on p.id = r.owner_id
      where r.is_active = true
    `;

    const pushConfig = webPushConfig(env);
    const pushSecret = env.PUSH_ENCRYPTION_KEY ?? "";
    const ownerIds = [...new Set(rows.map((row) => row.owner_id))];
    const subscriptions =
      pushConfig && pushSecret && ownerIds.length
        ? await sql<PushSubscriptionRow[]>`
            select id, owner_id, endpoint_encrypted, p256dh_encrypted, auth_encrypted
            from push_subscriptions
            where owner_id in ${sql(ownerIds)}
          `
        : [];

    const subscriptionsByOwner = new Map<string, PushSubscriptionRow[]>();
    for (const row of subscriptions) {
      const list = subscriptionsByOwner.get(row.owner_id) ?? [];
      list.push(row);
      subscriptionsByOwner.set(row.owner_id, list);
    }

    let due = 0;
    let emailed = 0;
    let pushed = 0;
    for (const reminder of rows) {
      // evaluateReminder's INPUT CONTRACT expects a `motorcycles` embed shape;
      // rebuild it from the joined columns instead of changing that function.
      // (Assigned to a plain variable, not passed as an inline literal, so
      // the extra `motorcycles` key doesn't trip TS excess-property checks
      // against evaluateReminder's ReminderInput param type.)
      const reminderForEvaluation = {
        ...reminder,
        motorcycles: {
          current_odometer_km: reminder.current_odometer_km,
          name: reminder.motorcycle_name,
        },
      };
      const evaluation = evaluateReminder(reminderForEvaluation, {
        currentOdometerKm: Number(reminder.current_odometer_km ?? 0),
        today,
      });
      if (evaluation.status !== "overdue" && evaluation.status !== "due_soon")
        continue;
      due += 1;

      const bikeName = reminder.motorcycle_name ?? "Moto";
      const body = `${bikeName}: ${reminder.title} (${evaluation.status})`;
      const now = new Date().toISOString();
      const updates: Record<string, string> = {};

      if (
        reminder.send_email &&
        !reminder.last_email_notified_at &&
        reminder.owner_email
      ) {
        const sent = await sendReminderEmail(env, {
          to: reminder.owner_email,
          subject: `Moto Track: ${reminder.title}`,
          text: `${bikeName}: ${reminder.title}\nStatus: ${evaluation.status}`,
        });
        if (sent) {
          emailed += 1;
          updates.last_email_notified_at = now;
          updates.last_notified_at = now;
        }
      }

      if (
        reminder.send_push &&
        !reminder.last_push_notified_at &&
        pushConfig &&
        pushSecret
      ) {
        const ownerSubs = subscriptionsByOwner.get(reminder.owner_id) ?? [];
        let delivered = false;
        for (const sub of ownerSubs) {
          try {
            const endpoint = await decryptPushField(
              sub.endpoint_encrypted,
              pushSecret,
            );
            if (!isAllowedPushEndpoint(endpoint)) {
              await sql`delete from push_subscriptions where id = ${sub.id}`;
              continue;
            }
            await sendWebPush(
              {
                endpoint,
                p256dh: await decryptPushField(
                  sub.p256dh_encrypted,
                  pushSecret,
                ),
                auth: await decryptPushField(sub.auth_encrypted, pushSecret),
              },
              {
                title: "Moto Track",
                body,
                url: "/reminders",
              },
              pushConfig,
            );
            delivered = true;
          } catch (cause) {
            const status =
              cause instanceof Error && /\((\d{3})\)/.exec(cause.message)?.[1];
            // Gone / Not Found subscriptions should be dropped so Conta can
            // renew them instead of retrying a dead endpoint forever.
            if (status === "404" || status === "410") {
              await sql`delete from push_subscriptions where id = ${sub.id}`;
            }
          }
        }
        if (delivered) {
          pushed += 1;
          updates.last_push_notified_at = now;
          updates.last_notified_at = updates.last_notified_at ?? now;
        }
      }

      if (Object.keys(updates).length) {
        await sql`
          update reminders
          set ${sql(updates)}
          where id = ${reminder.id}
        `;
      }
    }

    return { due, emailed, pushed };
  } finally {
    await sql.end();
  }
}

// Ported from supabase/functions/send-email/index.ts, now called in-process
// instead of via a Supabase Edge Function hop.
async function sendReminderEmail(
  env: Env,
  payload: { to: string; subject: string; text: string },
) {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      authorization: `Bearer ${env.RESEND_API_KEY}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      from: env.DEFAULT_FROM_EMAIL,
      to: [payload.to],
      subject: payload.subject,
      text: payload.text,
    }),
  });
  return response.ok;
}
