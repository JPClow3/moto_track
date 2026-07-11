import { redirect } from "@sveltejs/kit";
import { createCheckoutSession } from "$server/domain/billing";

export async function GET({ locals, url, platform }) {
  const user = locals.user;
  if (!user?.email) throw redirect(303, "/auth?redirectTo=/billing/checkout");
  const session = await createCheckoutSession({
    email: user.email,
    userId: user.id,
    interval: url.searchParams.get("interval") ?? "monthly",
    platform,
  });
  throw redirect(303, session.url ?? "/billing/conta");
}
