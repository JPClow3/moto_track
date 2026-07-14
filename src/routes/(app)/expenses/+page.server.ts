import { featureActions, loadFeature } from "$server/domain/crud";
export const actions = featureActions("expenses");
export async function load({ locals }) {
  return loadFeature(locals.supabase, "expenses", locals.user!);
}
