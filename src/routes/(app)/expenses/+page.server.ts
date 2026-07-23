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

const base = featureActions("expenses");
const v = (f: FormData, k: string) => String(f.get(k) ?? "").trim();

export const actions = {
  ...base,
  savePolicy: async ({ request, locals }) => {
    const f = await request.formData();
    const id = v(f, "id") || crypto.randomUUID();
    const payload = {
      id,
      owner_id: locals.user!.id,
      motorcycle_id: v(f, "motorcycle_id"),
      provider: v(f, "provider"),
      policy_number: v(f, "policy_number"),
      coverage_start: v(f, "coverage_start"),
      coverage_end: v(f, "coverage_end"),
      premium_cents: Math.round(Number(f.get("premium") ?? 0) * 100),
      notify_before_days: Number(f.get("notify_before_days") ?? 30),
      notes: v(f, "notes"),
    };
    const { error } = await locals.supabase
      .from("insurance_policies")
      .upsert(payload);
    if (error) return fail(400, { message: error.message });

    const reminderResult = await syncInsuranceReminder(
      locals.supabase,
      locals.user!.id,
      {
        id,
        motorcycle_id: payload.motorcycle_id,
        provider: payload.provider,
        coverage_end: payload.coverage_end,
        notify_before_days: payload.notify_before_days,
      },
    );
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
    const { data: policy } = await locals.supabase
      .from("insurance_policies")
      .select("id")
      .eq("id", policyId)
      .eq("owner_id", locals.user!.id)
      .maybeSingle();
    if (!policy) return fail(404, { message: "Seguro não encontrado." });
    const { error } = await locals.supabase.from("insurance_claims").insert({
      owner_id: locals.user!.id,
      policy_id: policyId,
      claim_date: v(f, "claim_date"),
      description: v(f, "description"),
      amount_cents: Math.round(Number(f.get("amount") ?? 0) * 100),
      status: v(f, "status") || "open",
    });
    return error ? fail(400, { message: error.message }) : { ok: true };
  },
  deletePolicy: async ({ request, locals }) => {
    const f = await request.formData();
    const id = v(f, "id");
    const error = await deleteOwnedRow(
      locals.supabase,
      "insurance_policies",
      id,
      locals.user!.id,
    );
    if (error) return fail(400, { message: error.message });
    await clearInsuranceReminder(locals.supabase, locals.user!.id, id);
    return { ok: true };
  },
  deleteClaim: async ({ request, locals }) => {
    const f = await request.formData();
    const error = await deleteOwnedRow(
      locals.supabase,
      "insurance_claims",
      v(f, "id"),
      locals.user!.id,
    );
    return error ? fail(400, { message: error.message }) : { ok: true };
  },
};

export async function load({ locals }) {
  const baseData = await loadFeature(locals.supabase, "expenses", locals.user!);
  const [policies, claims] = await Promise.all([
    locals.supabase
      .from("insurance_policies")
      .select("*")
      .eq("owner_id", locals.user!.id)
      .order("coverage_end"),
    locals.supabase
      .from("insurance_claims")
      .select("*, insurance_policies(provider, policy_number)")
      .eq("owner_id", locals.user!.id)
      .order("claim_date", { ascending: false }),
  ]);
  return {
    ...baseData,
    policies: (policies.data ?? []) as Array<{
      id: string;
      provider: string;
      policy_number: string | null;
      coverage_end: string;
      premium_cents: number | null;
    }>,
    claims: (claims.data ?? []) as Array<{
      id: string;
      claim_date: string;
      description: string;
      amount_cents: number | null;
      status: string;
      insurance_policies: {
        provider: string;
        policy_number: string | null;
      } | null;
    }>,
  };
}
