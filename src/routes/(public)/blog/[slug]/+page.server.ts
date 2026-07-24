import { error, fail } from "@sveltejs/kit";

const WORDS_PER_MINUTE = 200;

const readingMinutes = (body: string) =>
  Math.max(
    1,
    Math.ceil(
      (body ?? "").trim().split(/\s+/).filter(Boolean).length /
        WORDS_PER_MINUTE,
    ),
  );

function messageFrom(err: unknown) {
  return err instanceof Error ? err.message : String(err);
}

type ArticleRow = {
  id: string;
  title: string;
  slug: string;
  summary: string;
  meta_description: string;
  body: string;
  published_at: string;
};
type CommentRow = {
  id: string;
  owner_id: string;
  body: string;
  created_at: string;
};
type ReactionRow = { emoji: string; owner_id: string };
type RelatedRow = { title: string; slug: string; summary: string };
type ProfileRow = { id: string; full_name: string | null };

export async function load({ locals, params }) {
  const [article] = await locals.db<ArticleRow[]>`
    select * from forum_articles
    where slug = ${params.slug} and is_published = true
  `;
  if (!article) throw error(404, "Article not found");
  const articleId = String(article.id);

  const [comments, reactions, related] = await Promise.all([
    locals.db<CommentRow[]>`
      select id, owner_id, body, created_at from article_comments
      where article_id = ${articleId}
      order by created_at
    `,
    locals.db<ReactionRow[]>`
      select emoji, owner_id from article_reactions
      where article_id = ${articleId}
    `,
    // Sidebar/footer suggestions. Newest-first is a stand-in for real
    // relatedness — forum_article_categories is not populated yet.
    locals.db<RelatedRow[]>`
      select title, slug, summary from forum_articles
      where is_published = true and slug != ${params.slug}
      order by published_at desc
      limit 3
    `,
  ]);

  // Comment authors' display names are shown publicly on the article, same as
  // the old admin-client read — this is a deliberate cross-user lookup, not an
  // owner-scoped one.
  const ids = [...new Set(comments.map((comment) => comment.owner_id))];
  const profiles = ids.length
    ? await locals.db<ProfileRow[]>`
        select id, full_name from profiles where id in ${locals.db(ids)}
      `
    : [];
  const names = new Map(
    profiles.map((profile) => [
      profile.id,
      profile.full_name || "Motociclista",
    ]),
  );

  // Explicit generic (rather than letting it infer): spreading a
  // `Record<string, unknown>` alongside a literal property otherwise makes TS
  // drop the index signature from the result, rejecting every `article.<col>`
  // access in the page below.
  const enrichedArticle: ArticleRow & { reading_minutes: number } = {
    ...article,
    reading_minutes: readingMinutes(String(article.body ?? "")),
  };

  return {
    article: enrichedArticle,
    related,
    comments: comments.map((comment) => ({
      ...comment,
      author: names.get(comment.owner_id) ?? "Motociclista",
    })),
    reactions,
  };
}

export const actions = {
  comment: async ({ request, locals, params }) => {
    if (!locals.user) return fail(401, { message: "Entre para comentar." });
    const f = await request.formData();
    const body = String(f.get("body") ?? "").trim();
    if (!body) return fail(400, { message: "Escreva um comentário." });
    const [article] = await locals.db<Array<{ id: string }>>`
      select id from forum_articles
      where slug = ${params.slug} and is_published = true
    `;
    if (!article) return fail(404, { message: "Artigo não encontrado." });
    try {
      await locals.db`
        insert into article_comments ${locals.db({
          owner_id: locals.user.id,
          article_id: article.id,
          body,
        })}
      `;
    } catch (err) {
      return fail(400, { message: messageFrom(err) });
    }
    return { ok: true };
  },
  react: async ({ request, locals, params }) => {
    if (!locals.user) return fail(401, { message: "Entre para reagir." });
    const f = await request.formData();
    const emoji = String(f.get("emoji") ?? "👍");
    const ownerId = locals.user.id;
    const [article] = await locals.db<Array<{ id: string }>>`
      select id from forum_articles
      where slug = ${params.slug} and is_published = true
    `;
    if (!article) return fail(404, { message: "Artigo não encontrado." });
    const [existing] = await locals.db<Array<{ article_id: string }>>`
      select article_id from article_reactions
      where article_id = ${article.id} and owner_id = ${ownerId} and emoji = ${emoji}
    `;
    try {
      if (existing) {
        await locals.db`
          delete from article_reactions
          where article_id = ${article.id} and owner_id = ${ownerId} and emoji = ${emoji}
        `;
      } else {
        await locals.db`
          insert into article_reactions ${locals.db({
            article_id: article.id,
            owner_id: ownerId,
            emoji,
          })}
        `;
      }
    } catch (err) {
      return fail(400, { message: messageFrom(err) });
    }
    return { ok: true };
  },
};
