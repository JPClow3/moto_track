import { redirect } from "@sveltejs/kit";
import {
  billingEnvironment,
  createPortalSession,
  ensureBillingCustomer,
} from "$server/domain/billing";

export async function GET({ locals, platform }) {
  const user = locals.user;
  if (!user?.email) throw redirect(303, "/auth?redirectTo=/billing/portal");
  try {
    const [profile] = await locals.db<
      Array<{
        billing_customer_id: string | null;
        billing_provider: string | null;
        billing_environment: string | null;
      }>
    >`
      select billing_customer_id, billing_provider, billing_environment
      from subscription_profiles where owner_id = ${user.id}
    `;
    if (!profile?.billing_customer_id || profile.billing_provider !== "dodo")
      throw redirect(303, "/billing/conta");
    if (profile.billing_environment !== billingEnvironment(platform))
      throw new Error("Billing portal environment mismatch.");
    await ensureBillingCustomer({
      email: user.email,
      userId: user.id,
      customerId: profile.billing_customer_id,
      platform,
    });
    const session = await createPortalSession(
      profile.billing_customer_id,
      platform,
    );
    return redirect(303, session.link);
  } catch (error) {
    // Preserve SvelteKit redirects; provider and database failures are fail closed.
    if (
      typeof error === "object" &&
      error !== null &&
      "status" in error &&
      error.status === 303
    )
      throw error;
    console.error("Failed to create Dodo customer portal", error);
    throw redirect(303, "/billing/conta?portal=error");
  }
}
