import { featureActions, loadFeature } from "$server/domain/crud";
export const actions = featureActions("fuel");
export async function load({ locals }) {
  return loadFeature(locals.supabase, "fuel", locals.user!);
}
