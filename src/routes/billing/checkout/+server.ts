import { redirect } from "@sveltejs/kit";
import {
  createCheckoutSession,
  parseBillingInterval,
} from "$server/domain/billing";
import { hasProAccess } from "$server/domain/entitlements";

type SubscriptionProfileRow = {
  plan: string | null;
  stripe_subscription_status: string | null;
  grace_until: string | null;
  stripe_customer_id: string | null;
};

export async function GET({ locals, url, platform }) {
  const user = locals.user;
  if (!user?.email) throw redirect(303, "/auth?redirectTo=/billing/checkout");

  // Read is best-effort, matching the old `.maybeSingle()` call that never
  // checked its error either: a lookup failure just means we treat the user
  // as free/no-customer instead of failing the whole checkout redirect.
  const [profile] = await locals.db<SubscriptionProfileRow[]>`
    select plan, stripe_subscription_status, grace_until, stripe_customer_id
    from subscription_profiles
    where owner_id = ${user.id}
  `.catch(() => [] as SubscriptionProfileRow[]);

  if (hasProAccess(profile)) throw redirect(303, "/billing/portal");

  let session;
  try {
    session = await createCheckoutSession({
      email: user.email,
      userId: user.id,
      customerId: profile?.stripe_customer_id ?? undefined,
      interval: parseBillingInterval(url.searchParams.get("interval")),
      platform,
    });
  } catch (err) {
    console.error("Failed to create Stripe checkout session", err);
    throw redirect(303, "/precos?checkout=error");
  }
  throw redirect(303, session.url ?? "/billing/conta");
}
