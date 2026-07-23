import { fail } from "@sveltejs/kit";
import { featureActions, loadFeature } from "$server/domain/crud";

function messageFrom(err: unknown) {
  return err instanceof Error ? err.message : String(err);
}

const base = featureActions("documents");

export const actions = {
  ...base,
  createReminder: async ({ request, locals }) => {
    const f = await request.formData();
    const id = String(f.get("id") ?? "");
    const ownerId = locals.user!.id;

    let doc:
      | {
          motorcycle_id: string | null;
          name: string;
          valid_until: string | null;
          notify_before_days: number;
        }
      | undefined;
    try {
      [doc] = await locals.db<
        Array<{
          motorcycle_id: string | null;
          name: string;
          valid_until: string | null;
          notify_before_days: number;
        }>
      >`
        select motorcycle_id, name, valid_until, notify_before_days
        from motorcycle_documents
        where id = ${id} and owner_id = ${ownerId}
      `;
    } catch (err) {
      return fail(400, { message: messageFrom(err) });
    }
    if (!doc?.valid_until)
      return fail(400, { message: "Documento sem validade." });

    try {
      await locals.db`
        insert into reminders ${locals.db({
          owner_id: ownerId,
          motorcycle_id: doc.motorcycle_id,
          title: `Documento: ${doc.name}`,
          trigger_type: "by_date",
          trigger_value_days: doc.notify_before_days,
          reference_date: doc.valid_until,
          is_active: true,
          send_email: true,
          send_push: true,
          notes: `document:${id}`,
        })}
      `;
    } catch (err) {
      return fail(400, { message: messageFrom(err) });
    }
    return { ok: true };
  },
};

export async function load({ locals }) {
  return loadFeature(locals.db, "documents", locals.user!);
}
