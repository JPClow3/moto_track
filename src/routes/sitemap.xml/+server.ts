import type { RequestHandler } from "./$types";

const PUBLIC_PATHS = [
  "/",
  "/precos",
  "/blog",
  "/roadmap",
  "/termos",
  "/privacidade",
  "/lgpd",
  "/cancelamento",
];

function escapeXml(value: string) {
  return value.replace(
    /[<>&'"]/g,
    (character) =>
      ({
        "<": "&lt;",
        ">": "&gt;",
        "&": "&amp;",
        "'": "&apos;",
        '"': "&quot;",
      })[character]!,
  );
}

export const GET: RequestHandler = async ({ locals, url }) => {
  const origin =
    url.origin === "http://localhost" ? "https://moto-track.net" : url.origin;
  const articles = await locals.db<Array<{ slug: string; updated_at: string }>>`
    select slug, updated_at from forum_articles
    where is_published = true
    order by published_at desc
  `.catch(() => []);

  const entries = [
    ...PUBLIC_PATHS.map((path) => ({ path, updatedAt: null })),
    ...articles.map((article) => ({
      path: `/blog/${encodeURIComponent(article.slug)}`,
      updatedAt: article.updated_at,
    })),
  ];
  const body = entries
    .map(
      ({ path, updatedAt }) =>
        `  <url><loc>${escapeXml(`${origin}${path}`)}</loc>${
          updatedAt
            ? `<lastmod>${escapeXml(new Date(updatedAt).toISOString())}</lastmod>`
            : ""
        }</url>`,
    )
    .join("\n");

  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`,
    { headers: { "content-type": "application/xml; charset=utf-8" } },
  );
};
