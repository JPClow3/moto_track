import { createClient } from "@supabase/supabase-js";
import { evaluateReminder } from "../../src/lib/server/domain/reminders";
import {
  decryptPushField,
  isAllowedPushEndpoint,
} from "../../src/lib/server/domain/push-crypto";
import { sendWebPush, type WebPushConfig } from "./web-push";

export interface Env {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  EMAIL_FUNCTION_URL: string;
  EMAIL_FUNCTION_TOKEN: string;
  REMINDERS_TRIGGER_TOKEN: string;
  PUBLIC_VAPID_KEY?: string;
  VAPID_PRIVATE_KEY?: string;
  PUSH_ENCRYPTION_KEY?: string;
  VAPID_SUBJECT?: string;
}

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

export async function processReminders(env: Env) {
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

  const pushConfig = webPushConfig(env);
  const pushSecret = env.PUSH_ENCRYPTION_KEY ?? "";
  const { data: subscriptions, error: pushError } =
    pushConfig && pushSecret && ownerIds.length
      ? await supabase
          .from("push_subscriptions")
          .select(
            "id, owner_id, endpoint_encrypted, p256dh_encrypted, auth_encrypted",
          )
          .in("owner_id", ownerIds)
      : { data: [], error: null };
  if (pushError) throw pushError;

  const subscriptionsByOwner = new Map<
    string,
    Array<{
      id: string;
      endpoint_encrypted: string;
      p256dh_encrypted: string;
      auth_encrypted: string;
    }>
  >();
  for (const row of subscriptions ?? []) {
    const list = subscriptionsByOwner.get(row.owner_id) ?? [];
    list.push(row);
    subscriptionsByOwner.set(row.owner_id, list);
  }

  let due = 0;
  let emailed = 0;
  let pushed = 0;
  for (const reminder of reminders ?? []) {
    const evaluation = evaluateReminder(reminder, {
      currentOdometerKm: Number(reminder.motorcycles?.current_odometer_km ?? 0),
      today,
    });
    if (evaluation.status !== "overdue" && evaluation.status !== "due_soon")
      continue;
    due += 1;

    const bikeName = reminder.motorcycles?.name ?? "Moto";
    const body = `${bikeName}: ${reminder.title} (${evaluation.status})`;
    const now = new Date().toISOString();
    const updates: Record<string, string> = {};

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
          text: `${bikeName}: ${reminder.title}\nStatus: ${evaluation.status}`,
        }),
      });
      if (response.ok) {
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
            await supabase.from("push_subscriptions").delete().eq("id", sub.id);
            continue;
          }
          await sendWebPush(
            {
              endpoint,
              p256dh: await decryptPushField(sub.p256dh_encrypted, pushSecret),
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
          // Gone / Not Found subscriptions should be dropped so Conta can renew.
          if (status === "404" || status === "410") {
            await supabase.from("push_subscriptions").delete().eq("id", sub.id);
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
      await supabase.from("reminders").update(updates).eq("id", reminder.id);
    }
  }

  return { due, emailed, pushed };
}
