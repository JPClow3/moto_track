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
    templates,
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
    db<Row[]>`
      select * from motorcycle_templates
      order by brand, model
      limit 20
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
    templates,
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
    try {
      await locals.db`
        update account_data_requests
        set status = 'fulfilled', fulfilled_at = ${new Date().toISOString()}
        where id = ${String(form.get("id") ?? "")}
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
    try {
      await locals.db`
        insert into motorcycle_templates ${locals.db({
          brand: String(form.get("brand") ?? ""),
          model: String(form.get("model") ?? ""),
          year_from: Number(form.get("year_from") ?? 2000),
          year_to: form.get("year_to") ? Number(form.get("year_to")) : null,
          variant: String(form.get("variant") ?? ""),
          engine_cc: Number(form.get("engine_cc") ?? 1),
          country_code: String(form.get("country_code") ?? "BR"),
        })}
      `;
    } catch (err) {
      return fail(400, { message: messageFrom(err) });
    }
    return { ok: true };
  },
};
