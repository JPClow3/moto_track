import { fetchProPricing } from "$server/domain/billing";

export async function load({ platform }) {
  return { pricing: await fetchProPricing(platform) };
}
