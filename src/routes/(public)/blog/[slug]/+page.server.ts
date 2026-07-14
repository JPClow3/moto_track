import { error } from "@sveltejs/kit";

export async function load({ locals, params }) {
  const { data } = await locals.supabase
    .from("forum_articles")
    .select("*, forum_categories(name, slug)")
    .eq("slug", params.slug)
    .eq("is_published", true)
    .single();
  if (!data) throw error(404, "Article not found");
  return { article: data };
}
