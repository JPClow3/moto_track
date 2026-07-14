import { fail } from "@sveltejs/kit";
import { FREE_ACTIVE_MOTORCYCLE_LIMIT, hasProAccess } from "$server/domain/entitlements";
import { archiveMotorcycle, restoreMotorcycle } from "$server/domain/parity";
import { syncMotorcycleOdometer } from "$server/domain/odometer";

function value(form: FormData, key: string) {
  return String(form.get(key) ?? "").trim();
}

export async function load({ locals }) {
  const [motorcycles, profile] = await Promise.all([
    locals.supabase
      .from("motorcycles")
      .select("*, motorcycle_specs(*)")
      .eq("owner_id", locals.user!.id)
      .order("is_active", { ascending: false })
      .order("name"),
    locals.supabase
      .from("subscription_profiles")
      .select("plan, stripe_subscription_status, grace_until")
      .eq("owner_id", locals.user!.id)
      .maybeSingle(),
  ]);
  return {
    motorcycles: motorcycles.data ?? [],
    canAddActive:
      hasProAccess(profile.data) ||
      (motorcycles.data ?? []).filter((motorcycle) => motorcycle.is_active).length <
        FREE_ACTIVE_MOTORCYCLE_LIMIT,
  };
}

export const actions = {
  create: async ({ request, locals }) => {
    const form = await request.formData();
    const { count } = await locals.supabase
      .from("motorcycles")
      .select("id", { count: "exact", head: true })
      .eq("owner_id", locals.user!.id)
      .eq("is_active", true);
    const { data: profile } = await locals.supabase
      .from("subscription_profiles")
      .select("plan, stripe_subscription_status, grace_until")
      .eq("owner_id", locals.user!.id)
      .maybeSingle();
    if (!hasProAccess(profile) && (count ?? 0) >= FREE_ACTIVE_MOTORCYCLE_LIMIT) {
      return fail(403, { message: "O plano Free permite uma moto ativa." });
    }
    const name = value(form, "name");
    const brand = value(form, "brand");
    const model = value(form, "model");
    const year = Number(form.get("year"));
    if (!name || !brand || !model || !Number.isInteger(year)) {
      return fail(400, { message: "Informe nome, marca, modelo e ano válidos." });
    }
    const { error } = await locals.supabase.from("motorcycles").insert({
      owner_id: locals.user!.id,
      name,
      brand,
      model,
      year,
      current_odometer_km: Math.max(0, Number(form.get("current_odometer_km") ?? 0)),
      is_active: true,
    });
    return error ? fail(400, { message: error.message }) : { ok: true };
  },
  archive: async ({ request, locals }) => {
    const form = await request.formData();
    const { error } = await locals.supabase
      .from("motorcycles")
      .update(archiveMotorcycle())
      .eq("id", value(form, "id"))
      .eq("owner_id", locals.user!.id);
    return error ? fail(400, { message: error.message }) : { ok: true };
  },
  restore: async ({ request, locals }) => {
    const form = await request.formData();
    const { count } = await locals.supabase
      .from("motorcycles")
      .select("id", { count: "exact", head: true })
      .eq("owner_id", locals.user!.id)
      .eq("is_active", true);
    const { data: profile } = await locals.supabase
      .from("subscription_profiles")
      .select("plan, stripe_subscription_status, grace_until")
      .eq("owner_id", locals.user!.id)
      .maybeSingle();
    if (!hasProAccess(profile) && (count ?? 0) >= FREE_ACTIVE_MOTORCYCLE_LIMIT) {
      return fail(403, { message: "O plano Free permite uma moto ativa." });
    }
    const { error } = await locals.supabase
      .from("motorcycles")
      .update(restoreMotorcycle())
      .eq("id", value(form, "id"))
      .eq("owner_id", locals.user!.id);
    return error ? fail(400, { message: error.message }) : { ok: true };
  },
  saveSpecs: async ({ request, locals }) => {
    const form = await request.formData();
    const motorcycleId = value(form, "motorcycle_id");
    const { error } = await locals.supabase.from("motorcycle_specs").upsert({
      motorcycle_id: motorcycleId,
      tire_size_front: value(form, "tire_size_front"),
      tire_size_rear: value(form, "tire_size_rear"),
      recommended_tire_pressure_front: value(form, "recommended_tire_pressure_front"),
      recommended_tire_pressure_rear: value(form, "recommended_tire_pressure_rear"),
      manual_reference: value(form, "manual_reference"),
    });
    return error ? fail(400, { message: error.message }) : { ok: true };
  },
  updateOdometer: async ({ request, locals }) => {
    const form = await request.formData();
    const motorcycleId = value(form, "motorcycle_id");
    const override = Number(form.get("odometer_override_km"));
    if (!motorcycleId || !Number.isInteger(override) || override < 0) {
      return fail(400, { message: "Odômetro inválido." });
    }
    const { error } = await locals.supabase
      .from("motorcycles")
      .update({ odometer_override_km: override, odometer_override_at: new Date().toISOString() })
      .eq("id", motorcycleId)
      .eq("owner_id", locals.user!.id);
    if (error) return fail(400, { message: error.message });
    await syncMotorcycleOdometer(locals.supabase, locals.user!.id, motorcycleId);
    return { ok: true };
  },
};
