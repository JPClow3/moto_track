import { redirect } from "@sveltejs/kit";
import {
  createCheckoutSession,
  parseBillingInterval,
} from "$server/domain/billing";
import { hasProAccess } from "$server/domain/entitlements";

export async function GET({ locals, url, platform }) {
  const user = locals.user;
  if (!user?.email) throw redirect(303, "/auth?redirectTo=/billing/checkout");
  const { data: profile } = await locals.supabase
    .from("subscription_profiles")
    .select("plan, stripe_subscription_status, grace_until, stripe_customer_id")
    .eq("owner_id", user.id)
    .maybeSingle();
  if (hasProAccess(profile)) throw redirect(303, "/billing/portal");
  const session = await createCheckoutSession({
    email: user.email,
    userId: user.id,
    customerId: profile?.stripe_customer_id,
    interval: parseBillingInterval(url.searchParams.get("interval")),
    platform,
  });
  throw redirect(303, session.url ?? "/billing/conta");
}
