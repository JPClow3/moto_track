import { featureActions, loadFeature } from "$server/domain/crud";
export const actions = featureActions("documents");
export async function load({ locals }) {
  return loadFeature(locals.supabase, "documents", locals.user!);
}
