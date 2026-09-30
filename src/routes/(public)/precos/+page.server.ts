import { fetchProPricing } from "$server/domain/billing";
import { getSiteContact } from "$server/domain/site-contact";

export async function load({ locals, platform }) {
  const [pricing, contact] = await Promise.all([
    fetchProPricing(platform),
    getSiteContact(locals.db),
  ]);
  return { pricing, contact };
}
