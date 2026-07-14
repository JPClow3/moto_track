export async function load({ locals }) {
  const { data } = await locals.supabase
    .from("forum_articles")
    .select("title, slug, summary, published_at")
    .eq("is_published", true)
    .order("published_at", { ascending: false });
  return { articles: data ?? [] };
}
