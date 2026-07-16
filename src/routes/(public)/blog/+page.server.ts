// Reading time is derived from the body, so the body is selected here but never
// returned — the list would otherwise ship every full article to the client.
const WORDS_PER_MINUTE = 200;

const readingMinutes = (body: string) =>
  Math.max(
    1,
    Math.ceil(
      (body ?? "").trim().split(/\s+/).filter(Boolean).length /
        WORDS_PER_MINUTE,
    ),
  );

export async function load({ locals }) {
  const { data } = await locals.supabase
    .from("forum_articles")
    .select("title, slug, summary, published_at, body")
    .eq("is_published", true)
    .order("published_at", { ascending: false });

  return {
    articles: (data ?? []).map(({ body, ...article }) => ({
      ...article,
      reading_minutes: readingMinutes(body),
    })),
  };
}
