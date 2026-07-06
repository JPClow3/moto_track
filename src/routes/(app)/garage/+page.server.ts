import { featureActions, loadFeature } from "$server/domain/crud";
export const actions = featureActions("garage");
export async function load({ locals }) {
  return loadFeature(locals.supabase, "garage", locals.user!);
}
