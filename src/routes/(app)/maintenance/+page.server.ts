import { fail } from "@sveltejs/kit";
import {
  deleteOwnedRow,
  featureActions,
  loadFeature,
} from "$server/domain/crud";
import { assertCanCreateUpload } from "$server/domain/entitlement-guards";
import { validateMaintenancePhoto } from "$server/domain/maintenance-photos";
import { syncPlanReminder } from "$server/domain/record-sync";
import { uploadObjectFile } from "$server/r2/files";

type Row = Record<string, unknown>;

function messageFrom(err: unknown) {
  return err instanceof Error ? err.message : String(err);
}

const base = featureActions("maintenance");
const v = (f: FormData, k: string) => String(f.get(k) ?? "").trim();

export const actions = {
  ...base,
  savePart: async ({ request, locals }) => {
    const f = await request.formData();
    try {
      await locals.db`
        insert into maintenance_parts ${locals.db({
          owner_id: locals.user!.id,
          name: v(f, "name"),
          manufacturer: v(f, "manufacturer"),
          part_type: v(f, "part_type") || "other",
          price_cents: Math.round(Number(f.get("price") ?? 0) * 100),
          track_stock: f.get("track_stock") === "true",
          stock_quantity: Number(f.get("stock_quantity") ?? 0),
        })}
      `;
    } catch (err) {
      return fail(400, { message: messageFrom(err) });
    }
    return { ok: true };
  },
  deletePart: async ({ request, locals }) => {
    const f = await request.formData();
    const error = await deleteOwnedRow(
      locals.db,
      "maintenance_parts",
      v(f, "id"),
      locals.user!.id,
    );
    return error ? fail(400, { message: error }) : { ok: true };
  },
  savePlan: async ({ request, locals }) => {
    const f = await request.formData();
    const ownerId = locals.user!.id;
    const motorcycleId = v(f, "motorcycle_id");
    const type = v(f, "maintenance_type");
    const intervalKm = Number(f.get("interval_km")) || null;
    const intervalDays = Number(f.get("interval_days")) || null;

    // Explicit onConflict target matching the schema's unique combo
    // (motorcycle_id, maintenance_type, is_severe_duty_override) so saving
    // the same plan twice updates it instead of throwing a constraint error.
    let plan: { id: string } | undefined;
    try {
      [plan] = await locals.db<Array<{ id: string }>>`
        insert into maintenance_plan_items ${locals.db({
          owner_id: ownerId,
          motorcycle_id: motorcycleId,
          maintenance_type: type,
          interval_km: intervalKm,
          interval_days: intervalDays,
          is_severe_duty_override: false,
          is_active: true,
        })}
        on conflict (motorcycle_id, maintenance_type, is_severe_duty_override)
        do update set
          interval_km = excluded.interval_km,
          interval_days = excluded.interval_days,
          is_active = excluded.is_active,
          updated_at = now()
        where maintenance_plan_items.owner_id = ${ownerId}
        returning id
      `;
    } catch (err) {
      return fail(400, { message: messageFrom(err) });
    }
    if (!plan) return fail(400, { message: "Plano inválido." });

    const reminderResult = await syncPlanReminder(locals.db, ownerId, {
      id: plan.id,
      motorcycle_id: motorcycleId,
      maintenance_type: type,
      interval_km: intervalKm,
      interval_days: intervalDays,
    });
    if (!reminderResult.ok) {
      return fail(403, { message: reminderResult.message });
    }
    return { ok: true };
  },
  deletePlan: async ({ request, locals }) => {
    const f = await request.formData();
    const id = v(f, "id");
    const ownerId = locals.user!.id;
    const error = await deleteOwnedRow(
      locals.db,
      "maintenance_plan_items",
      id,
      ownerId,
    );
    if (error) return fail(400, { message: error });
    await locals.db`
      update reminders
      set is_active = false, updated_at = now()
      where owner_id = ${ownerId} and linked_plan_item_id = ${id}
    `;
    return { ok: true };
  },
  uploadPhoto: async ({ request, locals, platform }) => {
    const f = await request.formData();
    const ownerId = locals.user!.id;
    const recordId = v(f, "maintenance_record_id");
    const caption = v(f, "caption");
    const file = f.get("photo");
    if (!recordId) return fail(400, { message: "Selecione o registro." });

    const [record] = await locals.db<Array<{ id: string }>>`
      select id from maintenance_records
      where id = ${recordId} and owner_id = ${ownerId}
    `.catch(() => [] as Array<{ id: string }>);
    if (!record) return fail(404, { message: "Registro não encontrado." });

    const validation = validateMaintenancePhoto(
      file instanceof File ? file : null,
    );
    if (!validation.ok) return fail(400, { message: validation.message });

    const blocked = await assertCanCreateUpload(locals.db, ownerId);
    if (blocked) return fail(403, { message: blocked });

    const uploaded = await uploadObjectFile({
      file: validation.file,
      module: "maintenance",
      ownerId,
      platform,
    });
    const photoId = crypto.randomUUID();
    try {
      await locals.db`
        insert into object_files ${locals.db({
          owner_id: ownerId,
          module: "maintenance",
          source_table: "maintenance_photos",
          source_id: photoId,
          object_key: uploaded.objectKey,
          filename: uploaded.filename,
          content_type: uploaded.contentType,
          byte_size: uploaded.byteSize,
        })}
      `;
    } catch (err) {
      return fail(400, { message: messageFrom(err) });
    }
    try {
      await locals.db`
        insert into maintenance_photos ${locals.db({
          id: photoId,
          owner_id: ownerId,
          maintenance_record_id: recordId,
          image_key: uploaded.objectKey,
          caption,
        })}
      `;
    } catch (err) {
      return fail(400, { message: messageFrom(err) });
    }
    return { ok: true };
  },
  deletePhoto: async ({ request, locals }) => {
    const f = await request.formData();
    const error = await deleteOwnedRow(
      locals.db,
      "maintenance_photos",
      v(f, "id"),
      locals.user!.id,
    );
    return error ? fail(400, { message: error }) : { ok: true };
  },
};

export async function load({ locals }) {
  const ownerId = locals.user!.id;
  const baseData = await loadFeature(locals.db, "maintenance", locals.user!);
  const [parts, plans, photos] = await Promise.all([
    locals.db<Row[]>`
      select * from maintenance_parts
      where owner_id = ${ownerId}
      order by name
    `.catch(() => [] as Row[]),
    locals.db<Row[]>`
      select p.*, m.name as motorcycle_name
      from maintenance_plan_items p
      left join motorcycles m on m.id = p.motorcycle_id
      where p.owner_id = ${ownerId}
      order by p.maintenance_type
    `.catch(() => [] as Row[]),
    locals.db<Row[]>`
      select ph.*, r.date as record_date, r.maintenance_type as record_maintenance_type
      from maintenance_photos ph
      left join maintenance_records r on r.id = ph.maintenance_record_id
      where ph.owner_id = ${ownerId}
      order by ph.created_at desc
    `.catch(() => [] as Row[]),
  ]);
  return {
    ...baseData,
    parts,
    plans: plans.map(
      (plan): Row & { motorcycles: { name: unknown } | null } => ({
        ...plan,
        motorcycles: plan.motorcycle_name
          ? { name: plan.motorcycle_name }
          : null,
      }),
    ),
    photos: photos.map(
      (
        photo,
      ): Row & {
        maintenance_records: {
          date: unknown;
          maintenance_type: unknown;
        } | null;
      } => ({
        ...photo,
        maintenance_records: photo.record_date
          ? {
              date: photo.record_date,
              maintenance_type: photo.record_maintenance_type,
            }
          : null,
      }),
    ),
  };
}
