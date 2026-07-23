import { error, fail } from "@sveltejs/kit";
import { createSupabaseAdminClient } from "$server/supabase/admin";

const WORDS_PER_MINUTE = 200;

const readingMinutes = (body: string) =>
  Math.max(
    1,
    Math.ceil(
      (body ?? "").trim().split(/\s+/).filter(Boolean).length /
        WORDS_PER_MINUTE,
    ),
  );

export async function load({ locals, params, platform }) {
  const { data } = await locals.supabase
    .from("forum_articles")
    .select("*")
    .eq("slug", params.slug)
    .eq("is_published", true)
    .single();
  if (!data) throw error(404, "Article not found");
  const admin = createSupabaseAdminClient(platform);
  const [{ data: comments }, { data: reactions }, { data: related }] =
    await Promise.all([
      admin
        .from("article_comments")
        .select("id, owner_id, body, created_at")
        .eq("article_id", data.id)
        .order("created_at"),
      admin
        .from("article_reactions")
        .select("emoji, owner_id")
        .eq("article_id", data.id),
      // Sidebar/footer suggestions. Newest-first is a stand-in for real
      // relatedness — forum_article_categories is not populated yet.
      locals.supabase
        .from("forum_articles")
        .select("title, slug, summary")
        .eq("is_published", true)
        .neq("slug", params.slug)
        .order("published_at", { ascending: false })
        .limit(3),
    ]);
  const ids = [...new Set((comments ?? []).map((comment) => comment.owner_id))];
  const { data: profiles } = ids.length
    ? await admin.from("profiles").select("id, full_name").in("id", ids)
    : { data: [] };
  const names = new Map(
    (profiles ?? []).map((profile) => [
      profile.id,
      profile.full_name || "Motociclista",
    ]),
  );
  return {
    article: { ...data, reading_minutes: readingMinutes(data.body) },
    related: related ?? [],
    comments: (comments ?? []).map((comment) => ({
      ...comment,
      author: names.get(comment.owner_id) ?? "Motociclista",
    })),
    reactions: reactions ?? [],
  };
}
export const actions = {
  comment: async ({ request, locals, params }) => {
    if (!locals.user) return fail(401, { message: "Entre para comentar." });
    const f = await request.formData();
    const body = String(f.get("body") ?? "").trim();
    if (!body) return fail(400, { message: "Escreva um comentário." });
    const { data: article } = await locals.supabase
      .from("forum_articles")
      .select("id")
      .eq("slug", params.slug)
      .eq("is_published", true)
      .maybeSingle();
    if (!article) return fail(404, { message: "Artigo não encontrado." });
    const { error: insertError } = await locals.supabase
      .from("article_comments")
      .insert({ owner_id: locals.user.id, article_id: article.id, body });
    return insertError
      ? fail(400, { message: insertError.message })
      : { ok: true };
  },
  react: async ({ request, locals, params }) => {
    if (!locals.user) return fail(401, { message: "Entre para reagir." });
    const f = await request.formData();
    const emoji = String(f.get("emoji") ?? "👍");
    const { data: article } = await locals.supabase
      .from("forum_articles")
      .select("id")
      .eq("slug", params.slug)
      .eq("is_published", true)
      .maybeSingle();
    if (!article) return fail(404, { message: "Artigo não encontrado." });
    const { data: existing } = await locals.supabase
      .from("article_reactions")
      .select("article_id")
      .eq("article_id", article.id)
      .eq("owner_id", locals.user.id)
      .eq("emoji", emoji)
      .maybeSingle();
    const result = existing
      ? await locals.supabase
          .from("article_reactions")
          .delete()
          .eq("article_id", article.id)
          .eq("owner_id", locals.user.id)
          .eq("emoji", emoji)
      : await locals.supabase
          .from("article_reactions")
          .insert({ article_id: article.id, owner_id: locals.user.id, emoji });
    return result.error
      ? fail(400, { message: result.error.message })
      : { ok: true };
  },
};
