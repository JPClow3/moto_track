import { featureActions, loadFeature } from "$server/domain/crud";
export const actions = featureActions("trabalho");
export async function load({ locals }) {
  return loadFeature(locals.supabase, "trabalho", locals.user!);
}
