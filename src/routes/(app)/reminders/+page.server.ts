import { featureActions, loadFeature } from "$server/domain/crud";
export const actions = featureActions("reminders");
export async function load({ locals }) {
  return loadFeature(locals.supabase, "reminders", locals.user!);
}
