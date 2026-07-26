import { fail, redirect } from "@sveltejs/kit";
import {
  applyMotorcycleTemplate,
  getTemplateForYear,
  type MotorcycleCatalogPreview,
  type MotorcycleTemplate,
} from "$server/domain/motorcycle-catalog";

function messageFrom(err: unknown) {
  return err instanceof Error ? err.message : String(err);
}

type Row = Record<string, unknown>;

export async function load({ locals }) {
  const [motorcycles, templates] = await Promise.all([
    locals.db<Row[]>`
      select id from motorcycles
      where owner_id = ${locals.user!.id}
      limit 1
    `,
    locals.db<MotorcycleCatalogPreview[]>`
      select t.id, t.brand, t.model, t.year_from, t.year_to, t.variant,
        coalesce(s.manual_url, '') as manual_url,
        (select count(*)::int from motorcycle_template_maintenance_items mi where mi.template_id = t.id) as maintenance_count
      from motorcycle_templates t
      left join motorcycle_template_specs s on s.template_id = t.id
      order by t.brand, t.model
      limit 100
    `,
  ]);
  if (motorcycles.length) throw redirect(303, "/dashboard");
  return { templates };
}

export const actions = {
  create: async ({ request, locals }) => {
    const form = await request.formData();
    const name = String(form.get("name") ?? "").trim();
    let brand = String(form.get("brand") ?? "").trim();
    let model = String(form.get("model") ?? "").trim();
    const year = Number(form.get("year"));
    const enteredOdometer = Number(form.get("current_odometer_km") ?? 0);
    if (!Number.isFinite(enteredOdometer) || enteredOdometer < 0)
      return fail(400, { message: "Informe um odômetro válido." });
    const currentOdometerKm = Math.trunc(enteredOdometer);
    if (!name || !brand || !model || !Number.isInteger(year))
      return fail(400, { message: "Preencha os dados da moto." });
    const templateId = String(form.get("template_id") ?? "").trim() || null;
    if (templateId) {
      const template = await getTemplateForYear(locals.db, templateId, year);
      if (!template)
        return fail(400, {
          message: "Escolha um ano disponível para o modelo.",
        });
      brand = template.brand;
      model = template.model;
    }
    const motorcycleId = crypto.randomUUID();
    try {
      await locals.db.begin(async (tx) => {
        await tx`
          insert into motorcycles ${tx({
            id: motorcycleId,
            owner_id: locals.user!.id,
            name,
            brand,
            model,
            year,
            source_template_id: templateId,
            current_odometer_km: currentOdometerKm,
          })}
        `;
        if (templateId) {
          await applyMotorcycleTemplate(
            // `postgres`' transaction client has the same tagged-query API
            // used by the catalogue helper, but its type deliberately omits
            // connection-management members from the root Sql client.
            tx as unknown as typeof locals.db,
            locals.user!.id,
            motorcycleId,
            templateId,
            currentOdometerKm,
          );
        }
      });
    } catch (err) {
      return fail(400, { message: messageFrom(err) });
    }
    throw redirect(303, "/dashboard");
  },
  demo: async ({ locals }) => {
    try {
      await locals.db`
        insert into motorcycles ${locals.db({
          owner_id: locals.user!.id,
          name: "Moto de demonstração",
          brand: "Moto Track",
          model: "Demo",
          year: new Date().getFullYear(),
          current_odometer_km: 1200,
        })}
      `;
    } catch (err) {
      return fail(400, { message: messageFrom(err) });
    }
    throw redirect(303, "/dashboard");
  },
};
