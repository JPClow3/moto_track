import { fail, redirect } from "@sveltejs/kit";

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
    try {
      await locals.db`
        insert into motorcycles ${locals.db({
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
