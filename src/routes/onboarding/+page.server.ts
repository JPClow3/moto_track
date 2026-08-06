import { fail, redirect } from "@sveltejs/kit";
import {
  applyMotorcycleTemplate,
  initialHistoryStatus,
  loadCatalogModels,
  resolveCatalogSelection,
} from "$server/domain/motorcycle-catalog";

function messageFrom(err: unknown) {
  return err instanceof Error ? err.message : String(err);
}

type Row = Record<string, unknown>;

export async function load({ locals }) {
  const [motorcycles, models] = await Promise.all([
    locals.db<Row[]>`
      select id from motorcycles
      where owner_id = ${locals.user!.id}
      limit 1
    `,
    loadCatalogModels(locals.db),
  ]);
  if (motorcycles.length) throw redirect(303, "/dashboard");
  return { models };
}

export const actions = {
  create: async ({ request, locals }) => {
    const form = await request.formData();
    const name = String(form.get("name") ?? "").trim();
    const year = Number(form.get("year"));
    const currentYear = new Date().getFullYear();
    const enteredOdometer = Number(form.get("current_odometer_km") ?? 0);
    if (!Number.isFinite(enteredOdometer) || enteredOdometer < 0)
      return fail(400, { message: "Informe um odômetro válido." });
    const currentOdometerKm = Math.trunc(enteredOdometer);

    // Same rule as the garage: the picker submits a model and a year, and the
    // template is resolved server-side so brand and model come from the
    // catalogue row whose manual is about to be applied.
    const modelId = String(form.get("model_id") ?? "").trim() || null;
    let brand = String(form.get("brand") ?? "").trim();
    let model = String(form.get("model") ?? "").trim();
    let templateId: string | null = null;
    if (modelId) {
      const template = await resolveCatalogSelection(locals.db, modelId, year);
      if (!template)
        return fail(400, {
          message: "Escolha um ano disponível para o modelo.",
        });
      templateId = template.id;
      brand = template.brand;
      model = template.model;
    }
    if (
      !name ||
      !brand ||
      !model ||
      !Number.isInteger(year) ||
      year <= 1900 ||
      year > currentYear
    )
      return fail(400, { message: "Preencha os dados da moto." });
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
          const templateItems = await tx<Array<{ maintenance_type: string }>>`
            select maintenance_type
            from motorcycle_template_maintenance_items
            where template_id = ${templateId}
          `;
          const history = Object.fromEntries(
            templateItems.map((item) => [
              item.maintenance_type,
              initialHistoryStatus(
                String(form.get(`history_${item.maintenance_type}`) ?? ""),
              ),
            ]),
          );
          await applyMotorcycleTemplate(
            // `postgres`' transaction client has the same tagged-query API
            // used by the catalogue helper, but its type deliberately omits
            // connection-management members from the root Sql client.
            tx as unknown as typeof locals.db,
            locals.user!.id,
            motorcycleId,
            templateId,
            currentOdometerKm,
            history,
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
