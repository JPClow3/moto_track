import { fail, redirect } from "@sveltejs/kit";
import type { Sql } from "postgres";

function messageFrom(err: unknown) {
  return err instanceof Error ? err.message : String(err);
}

type Row = Record<string, unknown>;

async function applyTemplateSpecs(
  db: Sql,
  motorcycleId: string,
  templateId: string | null,
) {
  if (!templateId) return null;
  const [specs] = await db<Array<Record<string, string | number | null>>>`
    select * from motorcycle_template_specs where template_id = ${templateId}
  `.catch(() => [] as Array<Record<string, string | number | null>>);
  if (!specs) return null;
  try {
    await db`
      insert into motorcycle_specs ${db({
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
      })}
    `;
  } catch (err) {
    return messageFrom(err);
  }
  return null;
}

export async function load({ locals }) {
  const [motorcycles, templates] = await Promise.all([
    locals.db<Row[]>`
      select id from motorcycles
      where owner_id = ${locals.user!.id}
      limit 1
    `,
    locals.db<Row[]>`
      select id, brand, model, year_from, year_to, variant from motorcycle_templates
      order by brand
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
    const brand = String(form.get("brand") ?? "").trim();
    const model = String(form.get("model") ?? "").trim();
    const year = Number(form.get("year"));
    if (!name || !brand || !model || !Number.isInteger(year))
      return fail(400, { message: "Preencha os dados da moto." });
    const templateId = String(form.get("template_id") ?? "").trim() || null;
    const motorcycleId = crypto.randomUUID();
    try {
      await locals.db`
        insert into motorcycles ${locals.db({
          id: motorcycleId,
          owner_id: locals.user!.id,
          name,
          brand,
          model,
          year,
          source_template_id: templateId,
        })}
      `;
    } catch (err) {
      return fail(400, { message: messageFrom(err) });
    }
    const specsError = await applyTemplateSpecs(
      locals.db,
      motorcycleId,
      templateId,
    );
    if (specsError) return fail(400, { message: specsError });
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
