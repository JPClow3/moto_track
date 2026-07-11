import { redirect } from "@sveltejs/kit";
import { createPortalSession } from "$server/domain/billing";

export async function GET({ locals, platform }) {
  const { data: profile } = await locals.supabase
    .from("subscription_profiles")
    .select("stripe_customer_id")
    .eq("owner_id", locals.user!.id)
    .maybeSingle();
  if (!profile?.stripe_customer_id) throw redirect(303, "/billing/conta");
  const session = await createPortalSession(
    String(profile.stripe_customer_id),
    platform,
  );
  throw redirect(303, session.url);
}
