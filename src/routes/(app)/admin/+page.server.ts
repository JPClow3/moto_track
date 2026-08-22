import { fail } from "@sveltejs/kit";
import { isStaffUser as staffState } from "$server/domain/staff";

function messageFrom(err: unknown) {
  return err instanceof Error ? err.message : String(err);
}

type Row = Record<string, unknown>;

export async function load({ locals }) {
  const isStaff = await staffState(locals);
  if (!isStaff) {
    return {
      isStaff,
      settings: null,
      articles: [],
      templates: [],
      requests: [],
      counts: { users: 0, articles: 0, events: 0, requests: 0 },
    };
  }

  const db = locals.db;
  const [
    [{ count: users }],
    [{ count: articlesCount }],
    [{ count: events }],
    [{ count: requestsCount }],
    settingsRows,
    articles,
    manualSources,
    requests,
  ] = await Promise.all([
    db<Array<{ count: number }>>`select count(*)::int from profiles`,
    db<Array<{ count: number }>>`select count(*)::int from forum_articles`,
    db<Array<{ count: number }>>`select count(*)::int from billing_events`,
    db<
      Array<{ count: number }>
    >`select count(*)::int from account_data_requests`,
    db<Row[]>`select * from site_settings where id = 1`,
    db<Row[]>`
      select id, title, slug, is_published, published_at from forum_articles
      order by published_at desc
      limit 10
    `,
    // Catalogue QA: sources ordered oldest verification first, with the item
    // count that decides whether choosing the model yields any schedule at
    // all. Exact templates must have items; line models are allowed none.
    db<
      Array<{
        template_id: string;
        brand: string;
        model: string;
        year_from: number;
        year_to: number | null;
        variant: string;
        is_exact_schedule: boolean;
        document_version: string;
        last_verified_date: string;
        maintenance_count: number;
      }>
    >`
      select t.id as template_id, t.brand, t.model, t.year_from,
        t.year_to, t.variant, t.is_exact_schedule,
        ms.document_version, ms.last_verified_date::text,
        (select count(*)::int from motorcycle_template_maintenance_items mi
         where mi.template_id = t.id) as maintenance_count
      from motorcycle_manual_sources ms
      join motorcycle_templates t on t.id = ms.template_id
      order by ms.last_verified_date asc, t.brand, t.model
      limit 30
    `,
    db<Row[]>`
      select * from account_data_requests
      order by created_at desc
      limit 20
    `,
  ]);

  return {
    isStaff,
    settings: settingsRows[0] ?? null,
    articles,
    manualSources,
    requests,
    counts: {
      users,
      articles: articlesCount,
      events,
      requests: requestsCount,
    },
  };
}

export const actions = {
  fulfillDataRequest: async ({ request, locals }) => {
    if (!(await staffState(locals)))
      return fail(403, { message: "Staff only." });
    const form = await request.formData();
    const id = String(form.get("id") ?? "");

    let existing:
      { owner_id: string; request_type: string; status: string } | undefined;
    try {
      [existing] = await locals.db<
        Array<{ owner_id: string; request_type: string; status: string }>
      >`
        select owner_id, request_type, status from account_data_requests
        where id = ${id}
      `;
    } catch (err) {
      return fail(400, { message: messageFrom(err) });
    }
    if (!existing) return fail(404, { message: "Solicitação não encontrada." });
    if (existing.status !== "open") {
      return fail(400, { message: "Solicitação já processada." });
    }

    if (existing.request_type === "deletion") {
      // Every owner-scoped table (including profiles, subscription_profiles,
      // and this request row itself) references neon_auth."user"(id) with
      // `on delete cascade`, so removing the auth user row alone wipes the
      // account in one atomic statement — no per-table loop or separate
      // auth-admin call needed, unlike the old Supabase version.
      try {
        await locals.db`
          delete from neon_auth."user" where id = ${existing.owner_id}
        `;
      } catch (err) {
        return fail(400, { message: messageFrom(err) });
      }
      return { ok: true };
    }

    try {
      await locals.db`
        update account_data_requests
        set status = 'fulfilled', fulfilled_at = ${new Date().toISOString()}
        where id = ${id}
      `;
    } catch (err) {
      return fail(400, { message: messageFrom(err) });
    }
    return { ok: true };
  },
  saveSettings: async ({ request, locals }) => {
    if (!(await staffState(locals)))
      return fail(403, { message: "Staff only." });
    const form = await request.formData();
    try {
      await locals.db`
        insert into site_settings ${locals.db({
          id: 1,
          company_name: String(form.get("company_name") ?? "Moto Track"),
          support_email: String(form.get("support_email") ?? ""),
          support_phone: String(form.get("support_phone") ?? ""),
          support_whatsapp: String(form.get("support_whatsapp") ?? ""),
          address_city: String(form.get("address_city") ?? ""),
          address_state: String(form.get("address_state") ?? ""),
          dpo_name: String(form.get("dpo_name") ?? ""),
          dpo_email: String(form.get("dpo_email") ?? ""),
        })}
        on conflict (id) do update set
          company_name = excluded.company_name,
          support_email = excluded.support_email,
          support_phone = excluded.support_phone,
          support_whatsapp = excluded.support_whatsapp,
          address_city = excluded.address_city,
          address_state = excluded.address_state,
          dpo_name = excluded.dpo_name,
          dpo_email = excluded.dpo_email,
          updated_at = now()
      `;
    } catch (err) {
      return fail(400, { message: messageFrom(err) });
    }
    return { ok: true };
  },
  createArticle: async ({ request, locals }) => {
    if (!(await staffState(locals)))
      return fail(403, { message: "Staff only." });
    const form = await request.formData();
    const title = String(form.get("title") ?? "");
    const slug =
      String(form.get("slug") ?? "") ||
      title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
    try {
      await locals.db`
        insert into forum_articles ${locals.db({
          title,
          slug,
          summary: String(form.get("summary") ?? ""),
          body: String(form.get("body") ?? ""),
          is_published: form.get("is_published") === "true",
        })}
      `;
    } catch (err) {
      return fail(400, { message: messageFrom(err) });
    }
    return { ok: true };
  },
  createTemplate: async ({ request, locals }) => {
    if (!(await staffState(locals)))
      return fail(403, { message: "Staff only." });
    const form = await request.formData();
    const brand = String(form.get("brand") ?? "").trim();
    const modelName = String(form.get("model") ?? "").trim();
    const variant = String(form.get("variant") ?? "").trim() || "Linha";
    if (!brand || !modelName)
      return fail(400, { message: "Informe marca e modelo." });
    const yearFrom = Number(form.get("year_from"));
    if (!Number.isInteger(yearFrom) || yearFrom <= 1900) {
      return fail(400, { message: "Ano inicial inválido." });
    }
    const yearToValue = String(form.get("year_to") ?? "").trim();
    let yearTo: number | null = null;
    if (yearToValue) {
      const parsedYearTo = Number(yearToValue);
      if (!Number.isInteger(parsedYearTo) || parsedYearTo < yearFrom) {
        return fail(400, { message: "Ano final inválido." });
      }
      yearTo = parsedYearTo;
    }
    try {
      // The picker resolves (model, year) → template, so every new template
      // must hang off a motorcycle_models row; without one the catalog
      // selection trigger and the visibility constraint both reject it.
      // Upsert keeps repeated saves idempotent without touching is_visible.
      const [model] = await locals.db<Array<{ id: string }>>`
        insert into motorcycle_models ${locals.db({
          brand,
          model_name: modelName,
          variant,
          display_name:
            variant === "Linha" ? modelName : `${modelName} ${variant}`,
          engine_cc: Number(form.get("engine_cc") ?? 1),
          country_code: String(form.get("country_code") ?? "BR"),
          is_visible: false,
        })}
        on conflict (brand, model_name, variant, country_code) do update set
          updated_at = now()
        returning id
      `;
      // New templates stay invisible until a manual source exists — the same
      // rule the seeded catalogue follows (no source, no picker entry).
      await locals.db`
        insert into motorcycle_templates ${locals.db({
          brand,
          model: modelName,
          year_from: yearFrom,
          year_to: yearTo,
          variant,
          engine_cc: Number(form.get("engine_cc") ?? 1),
          country_code: String(form.get("country_code") ?? "BR"),
          model_id: model.id,
          is_catalog_visible: false,
        })}`;
    } catch (err) {
      return fail(400, { message: messageFrom(err) });
    }
    return { ok: true };
  },
};
