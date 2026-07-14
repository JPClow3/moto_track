import { fail, redirect } from "@sveltejs/kit";
async function load({ locals }) {
  const [{ data: motorcycles }, { data: templates }] = await Promise.all([
    locals.supabase.from("motorcycles").select("id").eq("owner_id", locals.user.id).limit(1),
    locals.supabase.from("motorcycle_templates").select("id, brand, model, year_from, year_to, variant").order("brand").limit(100)
  ]);
  if (motorcycles?.length) throw redirect(303, "/dashboard");
  return { templates: templates ?? [] };
}
const actions = {
  create: async ({ request, locals }) => {
    const form = await request.formData();
    const name = String(form.get("name") ?? "").trim();
    const brand = String(form.get("brand") ?? "").trim();
    const model = String(form.get("model") ?? "").trim();
    const year = Number(form.get("year"));
    if (!name || !brand || !model || !Number.isInteger(year)) return fail(400, { message: "Preencha os dados da moto." });
    const templateId = String(form.get("template_id") ?? "").trim() || null;
    const { error } = await locals.supabase.from("motorcycles").insert({ owner_id: locals.user.id, name, brand, model, year, source_template_id: templateId });
    if (error) return fail(400, { message: error.message });
    throw redirect(303, "/dashboard");
  },
  demo: async ({ locals }) => {
    const { error } = await locals.supabase.from("motorcycles").insert({ owner_id: locals.user.id, name: "Moto de demonstração", brand: "Moto Track", model: "Demo", year: (/* @__PURE__ */ new Date()).getFullYear(), current_odometer_km: 1200 });
    if (error) return fail(400, { message: error.message });
    throw redirect(303, "/dashboard");
  }
};
export {
  actions,
  load
};
