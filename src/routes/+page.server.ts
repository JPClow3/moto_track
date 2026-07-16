import { redirect } from "@sveltejs/kit";
import { fetchProPricing } from "$server/domain/billing";

type LandingArticle = { title: string; slug: string; summary: string };

/**
 * The guides are the main organic entry point into the product, so the landing
 * surfaces the three most recent instead of hiding them behind the nav.
 *
 * This never rejects. The landing page is the one page that must render even
 * when a dependency is down — same reasoning as fetchProPricing falling back to
 * a placeholder price rather than throwing. On failure the section just hides.
 */
async function fetchLatestArticles(
  supabase: App.Locals["supabase"],
): Promise<LandingArticle[]> {
  try {
    const { data, error } = await supabase
      .from("forum_articles")
      .select("title, slug, summary")
      .eq("is_published", true)
      .order("published_at", { ascending: false })
      .limit(3);
    return error ? [] : (data ?? []);
  } catch {
    return [];
  }
}

export async function load({ platform, locals }) {
  // The landing page is a pitch to people who don't have an account. Someone
  // who is already signed in wants their garage, not the pitch — so `/` is the
  // dashboard for them. Redirect before the Stripe/articles fetches so we don't
  // pay for work whose output is thrown away.
  if (locals.user) throw redirect(303, "/dashboard");

  const [pricing, articles] = await Promise.all([
    fetchProPricing(platform),
    fetchLatestArticles(locals.supabase),
  ]);

  return { pricing, articles };
}
