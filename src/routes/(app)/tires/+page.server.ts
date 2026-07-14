import { featureActions, loadFeature } from "$server/domain/crud";
export const actions = featureActions("tires");
export async function load({ locals }) {
  return loadFeature(locals.supabase, "tires", locals.user!);
}
