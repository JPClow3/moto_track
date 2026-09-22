import type { RequestHandler } from "./$types";

export const GET: RequestHandler = ({ url }) => {
  const origin =
    url.origin === "http://localhost" ? "https://moto-track.net" : url.origin;
  return new Response(
    [`User-agent: *`, `Allow: /`, `Sitemap: ${origin}/sitemap.xml`, ""].join(
      "\n",
    ),
    { headers: { "content-type": "text/plain; charset=utf-8" } },
  );
};
