import { fail } from "@sveltejs/kit";
import { featureActions, loadFeature } from "$server/domain/crud";

type Row = Record<string, unknown>;

function messageFrom(err: unknown) {
  return err instanceof Error ? err.message : String(err);
}

const base = featureActions("expenses");
const v = (f: FormData, k: string) => String(f.get(k) ?? "").trim();

export const actions = {
  ...base,
  savePolicy: async ({ request, locals }) => {
    const f = await request.formData();
    const id = v(f, "id") || crypto.randomUUID();
    const ownerId = locals.user!.id;
    const payload = {
      id,
      owner_id: ownerId,
      motorcycle_id: v(f, "motorcycle_id"),
      provider: v(f, "provider"),
      policy_number: v(f, "policy_number"),
      coverage_start: v(f, "coverage_start"),
      coverage_end: v(f, "coverage_end"),
      premium_cents: Math.round(Number(f.get("premium") ?? 0) * 100),
      notify_before_days: Number(f.get("notify_before_days") ?? 30),
      notes: v(f, "notes"),
    };
    try {
      // Conflict target is the primary key (`id`), matching the Supabase
      // upsert's implicit default. RLS used to stop a supplied id from
      // touching another owner's row — without it, the update side of the
      // upsert must check ownership itself: if the row belongs to someone
      // else, this `where` makes the conflicting row a no-op instead of an
      // IDOR-style overwrite.
      await locals.db`
        insert into insurance_policies ${locals.db(payload)}
        on conflict (id) do update set
          motorcycle_id = excluded.motorcycle_id,
          provider = excluded.provider,
          policy_number = excluded.policy_number,
          coverage_start = excluded.coverage_start,
          coverage_end = excluded.coverage_end,
          premium_cents = excluded.premium_cents,
          notify_before_days = excluded.notify_before_days,
          notes = excluded.notes,
          updated_at = now()
        where insurance_policies.owner_id = ${ownerId}
      `;
    } catch (err) {
      return fail(400, { message: messageFrom(err) });
    }

    // Best-effort linked reminder, matching the Supabase version, which never
    // checked this upsert's error. There is no unique constraint on
    // reminders(owner_id, title) in the schema, so `on conflict` here always
    // throws 42P10 — the exact same dead-on-arrival call the old code
    // silently swallowed via an unchecked `{ error }`.
    try {
      await locals.db`
        insert into reminders ${locals.db({
          owner_id: ownerId,
          motorcycle_id: payload.motorcycle_id,
          title: `Seguro: ${payload.provider}`,
          trigger_type: "by_date",
          trigger_value_days: payload.notify_before_days,
          reference_date: payload.coverage_end,
          is_active: true,
          send_email: true,
          send_push: true,
          notes: `insurance:${id}`,
        })}
        on conflict (owner_id, title) do update set
          trigger_value_days = excluded.trigger_value_days,
          reference_date = excluded.reference_date,
          notes = excluded.notes
      `;
    } catch {
      // Ignored — see comment above.
    }
    return { ok: true };
  },
  saveClaim: async ({ request, locals }) => {
    const f = await request.formData();
    const policyId = v(f, "policy_id");
    const ownerId = locals.user!.id;
    let policy: { id: string } | undefined;
    try {
      [policy] = await locals.db<Array<{ id: string }>>`
        select id from insurance_policies
        where id = ${policyId} and owner_id = ${ownerId}
      `;
    } catch {
      // Falls through to the not-found response below, matching the
      // Supabase version's unchecked `{ data: policy }` destructure.
    }
    if (!policy) return fail(404, { message: "Seguro não encontrado." });
    try {
      await locals.db`
        insert into insurance_claims ${locals.db({
          owner_id: ownerId,
          policy_id: policyId,
          claim_date: v(f, "claim_date"),
          description: v(f, "description"),
          amount_cents: Math.round(Number(f.get("amount") ?? 0) * 100),
          status: v(f, "status") || "open",
        })}
      `;
    } catch (err) {
      return fail(400, { message: messageFrom(err) });
    }
    return { ok: true };
  },
  deletePolicy: async ({ request, locals }) => {
    const f = await request.formData();
    try {
      await locals.db`
        delete from insurance_policies
        where id = ${v(f, "id")} and owner_id = ${locals.user!.id}
      `;
    } catch (err) {
      return fail(400, { message: messageFrom(err) });
    }
    return { ok: true };
  },
};

export async function load({ locals }) {
  const ownerId = locals.user!.id;
  const baseData = await loadFeature(locals.db, "expenses", locals.user!);
  const [policies, claims] = await Promise.all([
    locals.db<Row[]>`
      select * from insurance_policies
      where owner_id = ${ownerId}
      order by coverage_end
    `.catch(() => [] as Row[]),
    locals.db<Row[]>`
      select * from insurance_claims
      where owner_id = ${ownerId}
      order by claim_date desc
    `.catch(() => [] as Row[]),
  ]);
  return {
    ...baseData,
    policies,
    claims,
  };
}
