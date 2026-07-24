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

type ArticleRow = {
  title: string;
  slug: string;
  summary: string;
  published_at: string;
  body: string;
};

export async function load({ locals }) {
  const data = await locals.db<ArticleRow[]>`
    select title, slug, summary, published_at, body from forum_articles
    where is_published = true
    order by published_at desc
  `;

  return {
    articles: data.map(({ body, ...article }) => ({
      ...article,
      reading_minutes: readingMinutes(body),
    })),
  };
}
