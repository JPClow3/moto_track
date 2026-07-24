import { redirect } from "@sveltejs/kit";
import { createPortalSession } from "$server/domain/billing";

export async function GET({ locals, platform }) {
  // Best-effort read (matches the old unchecked `.maybeSingle()`): any lookup
  // failure just sends the user back to the account page instead of 500ing.
  const [profile] = await locals.db<
    Array<{ stripe_customer_id: string | null }>
  >`
    select stripe_customer_id from subscription_profiles
    where owner_id = ${locals.user!.id}
  `.catch(() => [] as Array<{ stripe_customer_id: string | null }>);
  if (!profile?.stripe_customer_id) throw redirect(303, "/billing/conta");
  const session = await createPortalSession(
    String(profile.stripe_customer_id),
    platform,
  );
  throw redirect(303, session.url);
}
