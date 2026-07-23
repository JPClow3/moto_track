import { fail } from "@sveltejs/kit";
import { featureActions, loadFeature } from "$server/domain/crud";
import { assertCanCreateReminder } from "$server/domain/entitlement-guards";

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

    const noteTag = `insurance:${id}`;
    const { data: existingReminder } = await locals.supabase
      .from("reminders")
      .select("id")
      .eq("owner_id", locals.user!.id)
      .eq("notes", noteTag)
      .maybeSingle();

    if (!existingReminder) {
      const blocked = await assertCanCreateReminder(
        locals.supabase,
        locals.user!.id,
      );
      if (blocked) {
        return fail(403, {
          message: `Seguro salvo, mas o lembrete não foi criado: ${blocked}`,
        });
      }
    }

    const reminder = {
      owner_id: locals.user!.id,
      motorcycle_id: payload.motorcycle_id,
      title: `Seguro: ${payload.provider}`,
      trigger_type: "by_date" as const,
      trigger_value_days: payload.notify_before_days,
      reference_date: payload.coverage_end,
      is_active: true,
      send_email: true,
      send_push: true,
      notes: noteTag,
      updated_at: new Date().toISOString(),
    };

    const reminderResult = existingReminder
      ? await locals.supabase
          .from("reminders")
          .update(reminder)
          .eq("id", existingReminder.id)
          .eq("owner_id", locals.user!.id)
      : await locals.supabase.from("reminders").insert(reminder);

    if (reminderResult.error) {
      return fail(400, {
        message: `Seguro salvo, mas o lembrete falhou: ${reminderResult.error.message}`,
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
    const { error } = await locals.supabase
      .from("insurance_policies")
      .delete()
      .eq("id", id)
      .eq("owner_id", locals.user!.id);
    if (error) return fail(400, { message: error.message });
    await locals.supabase
      .from("reminders")
      .delete()
      .eq("owner_id", locals.user!.id)
      .eq("notes", `insurance:${id}`);
    return { ok: true };
  },
  deleteClaim: async ({ request, locals }) => {
    const f = await request.formData();
    const { error } = await locals.supabase
      .from("insurance_claims")
      .delete()
      .eq("id", v(f, "id"))
      .eq("owner_id", locals.user!.id);
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
