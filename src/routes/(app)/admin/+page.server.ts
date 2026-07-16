import { fail } from "@sveltejs/kit";
import { createSupabaseAdminClient } from "$server/supabase/admin";
import { isStaffUser as staffState } from "$server/domain/staff";

export async function load({ locals, platform }) {
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

  const supabase = createSupabaseAdminClient(platform);
  const [
    { count: users },
    { count: articlesCount },
    { count: events },
    { count: requestsCount },
    { data: settings },
    { data: articles },
    { data: templates },
    { data: requests },
  ] = await Promise.all([
    supabase.from("profiles").select("*", { count: "exact", head: true }),
    supabase.from("forum_articles").select("*", { count: "exact", head: true }),
    supabase.from("billing_events").select("*", { count: "exact", head: true }),
    supabase
      .from("account_data_requests")
      .select("*", { count: "exact", head: true }),
    supabase.from("site_settings").select("*").eq("id", 1).maybeSingle(),
    supabase
      .from("forum_articles")
      .select("id, title, slug, is_published, published_at")
      .order("published_at", { ascending: false })
      .limit(10),
    supabase
      .from("motorcycle_templates")
      .select("*")
      .order("brand")
      .order("model")
      .limit(20),
    supabase
      .from("account_data_requests")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  return {
    isStaff,
    settings,
    articles: articles ?? [],
    templates: templates ?? [],
    requests: requests ?? [],
    counts: {
      users,
      articles: articlesCount,
      events,
      requests: requestsCount,
    },
  };
}

export const actions = {
  fulfillDataRequest: async ({ request, locals, platform }) => {
    if (!(await staffState(locals)))
      return fail(403, { message: "Staff only." });
    const form = await request.formData();
    const { error } = await createSupabaseAdminClient(platform)
      .from("account_data_requests")
      .update({ status: "fulfilled", fulfilled_at: new Date().toISOString() })
      .eq("id", String(form.get("id") ?? ""));
    return error ? fail(400, { message: error.message }) : { ok: true };
  },
  saveSettings: async ({ request, locals, platform }) => {
    if (!(await staffState(locals)))
      return fail(403, { message: "Staff only." });
    const form = await request.formData();
    const supabase = createSupabaseAdminClient(platform);
    const { error } = await supabase.from("site_settings").upsert({
      id: 1,
      company_name: String(form.get("company_name") ?? "Moto Track"),
      support_email: String(form.get("support_email") ?? ""),
      support_phone: String(form.get("support_phone") ?? ""),
      support_whatsapp: String(form.get("support_whatsapp") ?? ""),
      address_city: String(form.get("address_city") ?? ""),
      address_state: String(form.get("address_state") ?? ""),
      dpo_name: String(form.get("dpo_name") ?? ""),
      dpo_email: String(form.get("dpo_email") ?? ""),
    });
    return error ? fail(400, { message: error.message }) : { ok: true };
  },
  createArticle: async ({ request, locals, platform }) => {
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
    const supabase = createSupabaseAdminClient(platform);
    const { error } = await supabase.from("forum_articles").insert({
      title,
      slug,
      summary: String(form.get("summary") ?? ""),
      body: String(form.get("body") ?? ""),
      is_published: form.get("is_published") === "true",
    });
    return error ? fail(400, { message: error.message }) : { ok: true };
  },
  createTemplate: async ({ request, locals, platform }) => {
    if (!(await staffState(locals)))
      return fail(403, { message: "Staff only." });
    const form = await request.formData();
    const supabase = createSupabaseAdminClient(platform);
    const { error } = await supabase.from("motorcycle_templates").insert({
      brand: String(form.get("brand") ?? ""),
      model: String(form.get("model") ?? ""),
      year_from: Number(form.get("year_from") ?? 2000),
      year_to: form.get("year_to") ? Number(form.get("year_to")) : null,
      variant: String(form.get("variant") ?? ""),
      engine_cc: Number(form.get("engine_cc") ?? 1),
      country_code: String(form.get("country_code") ?? "BR"),
    });
    return error ? fail(400, { message: error.message }) : { ok: true };
  },
};
