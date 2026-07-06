import { featureActions, loadFeature } from "$server/domain/crud";
export const actions = featureActions("maintenance");
export async function load({ locals }) {
  return loadFeature(locals.supabase, "maintenance", locals.user!);
}
