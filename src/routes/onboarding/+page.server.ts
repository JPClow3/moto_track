import { fail, redirect } from "@sveltejs/kit";

export async function load({ locals }) {
  const [{ data: motorcycles }, { data: templates }] = await Promise.all([
    locals.supabase
      .from("motorcycles")
      .select("id")
      .eq("owner_id", locals.user!.id)
      .limit(1),
    locals.supabase
      .from("motorcycle_templates")
      .select("id, brand, model, year_from, year_to, variant")
      .order("brand")
      .limit(100),
  ]);
  if (motorcycles?.length) throw redirect(303, "/dashboard");
  return { templates: templates ?? [] };
}

async function applyTemplateSpecs(
  supabase: App.Locals["supabase"],
  motorcycleId: string,
  templateId: string | null,
) {
  if (!templateId) return null;
  const { data: specs } = await supabase
    .from("motorcycle_template_specs")
    .select("*")
    .eq("template_id", templateId)
    .maybeSingle();
  if (!specs) return null;
  const { error } = await supabase.from("motorcycle_specs").upsert({
    motorcycle_id: motorcycleId,
    fuel_tank_capacity_l: specs.fuel_tank_capacity_l,
    fuel_type_recommendation: specs.fuel_type_recommendation,
    fuel_octane_min: specs.fuel_octane_min,
    oil_capacity_l: specs.oil_capacity_l,
    tire_size_front: specs.tire_size_front,
    tire_size_rear: specs.tire_size_rear,
    tire_speed_rating: specs.tire_speed_rating,
    battery_spec: specs.battery_spec,
    chain_size: specs.chain_size,
    recommended_tire_pressure_front: specs.recommended_tire_pressure_front,
    recommended_tire_pressure_rear: specs.recommended_tire_pressure_rear,
    oil_type_recommendation: specs.oil_type_recommendation,
    oil_viscosity_recommendation: specs.oil_viscosity_recommendation,
    manual_reference: specs.manual_url,
    consumption_avg_km_l: specs.consumption_avg_km_l,
    updated_at: new Date().toISOString(),
  });
  return error?.message ?? null;
}

export const actions = {
  create: async ({ request, locals }) => {
    const form = await request.formData();
    const name = String(form.get("name") ?? "").trim();
    const brand = String(form.get("brand") ?? "").trim();
    const model = String(form.get("model") ?? "").trim();
    const year = Number(form.get("year"));
    if (!name || !brand || !model || !Number.isInteger(year))
      return fail(400, { message: "Preencha os dados da moto." });
    const templateId = String(form.get("template_id") ?? "").trim() || null;
    const motorcycleId = crypto.randomUUID();
    const { error } = await locals.supabase.from("motorcycles").insert({
      id: motorcycleId,
      owner_id: locals.user!.id,
      name,
      brand,
      model,
      year,
      source_template_id: templateId,
    });
    if (error) return fail(400, { message: error.message });
    const specsError = await applyTemplateSpecs(
      locals.supabase,
      motorcycleId,
      templateId,
    );
    if (specsError) return fail(400, { message: specsError });
    throw redirect(303, "/dashboard");
  },
  demo: async ({ locals }) => {
    const { error } = await locals.supabase.from("motorcycles").insert({
      owner_id: locals.user!.id,
      name: "Moto de demonstração",
      brand: "Moto Track",
      model: "Demo",
      year: new Date().getFullYear(),
      current_odometer_km: 1200,
    });
    if (error) return fail(400, { message: error.message });
    throw redirect(303, "/dashboard");
  },
};
