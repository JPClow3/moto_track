import { fail } from "@sveltejs/kit";
import {
  deleteOwnedRow,
  featureActions,
  loadFeature,
} from "$server/domain/crud";
import {
  clearInsuranceReminder,
  syncInsuranceReminder,
} from "$server/domain/record-sync";

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

    const reminderResult = await syncInsuranceReminder(locals.db, ownerId, {
      id,
      motorcycle_id: payload.motorcycle_id,
      provider: payload.provider,
      coverage_end: payload.coverage_end,
      notify_before_days: payload.notify_before_days,
    });
    if (!reminderResult.ok) {
      return fail(403, {
        message: `Seguro salvo, mas o lembrete não foi criado: ${reminderResult.message}`,
      });
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
    const id = v(f, "id");
    const ownerId = locals.user!.id;
    const error = await deleteOwnedRow(
      locals.db,
      "insurance_policies",
      id,
      ownerId,
    );
    if (error) return fail(400, { message: error });
    await clearInsuranceReminder(locals.db, ownerId, id);
    return { ok: true };
  },
  deleteClaim: async ({ request, locals }) => {
    const f = await request.formData();
    const error = await deleteOwnedRow(
      locals.db,
      "insurance_claims",
      v(f, "id"),
      locals.user!.id,
    );
    return error ? fail(400, { message: error }) : { ok: true };
  },
};

type PolicyRow = {
  id: string;
  provider: string;
  policy_number: string | null;
  coverage_end: string;
  premium_cents: number | null;
};

type ClaimRow = {
  id: string;
  claim_date: string;
  description: string;
  amount_cents: number | null;
  status: string;
  policy_provider: string | null;
  policy_number: string | null;
};

export async function load({ locals }) {
  const ownerId = locals.user!.id;
  const baseData = await loadFeature(locals.db, "expenses", locals.user!);
  const [policies, claims] = await Promise.all([
    locals.db<PolicyRow[]>`
      select id, provider, policy_number, coverage_end, premium_cents
      from insurance_policies
      where owner_id = ${ownerId}
      order by coverage_end
    `.catch(() => [] as PolicyRow[]),
    locals.db<ClaimRow[]>`
      select c.id, c.claim_date, c.description, c.amount_cents, c.status,
        p.provider as policy_provider, p.policy_number
      from insurance_claims c
      left join insurance_policies p on p.id = c.policy_id
      where c.owner_id = ${ownerId}
      order by c.claim_date desc
    `.catch(() => [] as ClaimRow[]),
  ]);
  return {
    ...baseData,
    policies,
    claims: claims.map((claim) => ({
      ...claim,
      insurance_policies: claim.policy_provider
        ? {
            provider: claim.policy_provider,
            policy_number: claim.policy_number,
          }
        : null,
    })),
  };
}
