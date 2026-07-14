import { fail } from "@sveltejs/kit";
import { featureActions, loadFeature } from "$server/domain/crud";
const base = featureActions("documents");
export const actions = {
  ...base,
  createReminder: async ({ request, locals }) => {
    const f = await request.formData();
    const id = String(f.get("id") ?? "");
    const { data: doc } = await locals.supabase
      .from("motorcycle_documents")
      .select("*")
      .eq("id", id)
      .eq("owner_id", locals.user!.id)
      .maybeSingle();
    if (!doc?.valid_until)
      return fail(400, { message: "Documento sem validade." });
    const { error } = await locals.supabase.from("reminders").insert({
      owner_id: locals.user!.id,
      motorcycle_id: doc.motorcycle_id,
      title: `Documento: ${doc.name}`,
      trigger_type: "by_date",
      trigger_value_days: doc.notify_before_days,
      reference_date: doc.valid_until,
      is_active: true,
      send_email: true,
      send_push: true,
      notes: `document:${doc.id}`,
    });
    return error ? fail(400, { message: error.message }) : { ok: true };
  },
};
export async function load({ locals }) {
  return loadFeature(locals.supabase, "documents", locals.user!);
}
