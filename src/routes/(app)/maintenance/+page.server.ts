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

const base = featureActions("maintenance");
const v = (f: FormData, k: string) => String(f.get(k) ?? "").trim();

export const actions = {
  ...base,
  savePart: async ({ request, locals }) => {
    const f = await request.formData();
    const { error } = await locals.supabase.from("maintenance_parts").insert({
      owner_id: locals.user!.id,
      name: v(f, "name"),
      manufacturer: v(f, "manufacturer"),
      part_type: v(f, "part_type") || "other",
      price_cents: Math.round(Number(f.get("price") ?? 0) * 100),
      track_stock: f.get("track_stock") === "true",
      stock_quantity: Number(f.get("stock_quantity") ?? 0),
    });
    return error ? fail(400, { message: error.message }) : { ok: true };
  },
  deletePart: async ({ request, locals }) => {
    const f = await request.formData();
    const error = await deleteOwnedRow(
      locals.supabase,
      "maintenance_parts",
      v(f, "id"),
      locals.user!.id,
    );
    return error ? fail(400, { message: error.message }) : { ok: true };
  },
  savePlan: async ({ request, locals }) => {
    const f = await request.formData();
    const motorcycleId = v(f, "motorcycle_id");
    const type = v(f, "maintenance_type");
    const intervalKm = Number(f.get("interval_km")) || null;
    const intervalDays = Number(f.get("interval_days")) || null;
    const { data: plan, error } = await locals.supabase
      .from("maintenance_plan_items")
      .upsert(
        {
          owner_id: locals.user!.id,
          motorcycle_id: motorcycleId,
          maintenance_type: type,
          interval_km: intervalKm,
          interval_days: intervalDays,
          is_severe_duty_override: false,
          is_active: true,
        },
        {
          onConflict: "motorcycle_id,maintenance_type,is_severe_duty_override",
        },
      )
      .select()
      .single();
    if (error || !plan)
      return fail(400, { message: error?.message ?? "Plano inválido." });
    const reminderResult = await syncPlanReminder(
      locals.supabase,
      locals.user!.id,
      {
        id: plan.id,
        motorcycle_id: motorcycleId,
        maintenance_type: type,
        interval_km: intervalKm,
        interval_days: intervalDays,
      },
    );
    if (!reminderResult.ok) {
      return fail(403, { message: reminderResult.message });
    }
    return { ok: true };
  },
  deletePlan: async ({ request, locals }) => {
    const f = await request.formData();
    const id = v(f, "id");
    const error = await deleteOwnedRow(
      locals.supabase,
      "maintenance_plan_items",
      id,
      locals.user!.id,
    );
    if (error) return fail(400, { message: error.message });
    await locals.supabase
      .from("reminders")
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq("owner_id", locals.user!.id)
      .eq("linked_plan_item_id", id);
    return { ok: true };
  },
  uploadPhoto: async ({ request, locals, platform }) => {
    const f = await request.formData();
    const recordId = v(f, "maintenance_record_id");
    const caption = v(f, "caption");
    const file = f.get("photo");
    if (!recordId) return fail(400, { message: "Selecione o registro." });
    const { data: record } = await locals.supabase
      .from("maintenance_records")
      .select("id")
      .eq("id", recordId)
      .eq("owner_id", locals.user!.id)
      .maybeSingle();
    if (!record) return fail(404, { message: "Registro não encontrado." });
    const validation = validateMaintenancePhoto(
      file instanceof File ? file : null,
    );
    if (!validation.ok) return fail(400, { message: validation.message });
    const blocked = await assertCanCreateUpload(
      locals.supabase,
      locals.user!.id,
    );
    if (blocked) return fail(403, { message: blocked });
    const uploaded = await uploadObjectFile({
      file: validation.file,
      module: "maintenance",
      ownerId: locals.user!.id,
      platform,
    });
    const photoId = crypto.randomUUID();
    const { error: fileError } = await locals.supabase
      .from("object_files")
      .insert({
        owner_id: locals.user!.id,
        module: "maintenance",
        source_table: "maintenance_photos",
        source_id: photoId,
        object_key: uploaded.objectKey,
        filename: uploaded.filename,
        content_type: uploaded.contentType,
        byte_size: uploaded.byteSize,
      });
    if (fileError) return fail(400, { message: fileError.message });
    const { error } = await locals.supabase.from("maintenance_photos").insert({
      id: photoId,
      owner_id: locals.user!.id,
      maintenance_record_id: recordId,
      image_key: uploaded.objectKey,
      caption,
    });
    return error ? fail(400, { message: error.message }) : { ok: true };
  },
  deletePhoto: async ({ request, locals }) => {
    const f = await request.formData();
    const error = await deleteOwnedRow(
      locals.supabase,
      "maintenance_photos",
      v(f, "id"),
      locals.user!.id,
    );
    return error ? fail(400, { message: error.message }) : { ok: true };
  },
};

export async function load({ locals }) {
  const baseData = await loadFeature(
    locals.supabase,
    "maintenance",
    locals.user!,
  );
  const [parts, plans, photos] = await Promise.all([
    locals.supabase
      .from("maintenance_parts")
      .select("*")
      .eq("owner_id", locals.user!.id)
      .order("name"),
    locals.supabase
      .from("maintenance_plan_items")
      .select("*, motorcycles(name)")
      .eq("owner_id", locals.user!.id)
      .order("maintenance_type"),
    locals.supabase
      .from("maintenance_photos")
      .select("*, maintenance_records(date, maintenance_type)")
      .eq("owner_id", locals.user!.id)
      .order("created_at", { ascending: false }),
  ]);
  return {
    ...baseData,
    parts: (parts.data ?? []) as Array<{
      id: string;
      name: string;
      manufacturer: string;
      price_cents: number | null;
      track_stock: boolean;
      stock_quantity: number;
    }>,
    plans: (plans.data ?? []) as Array<{
      id: string;
      maintenance_type: string;
      interval_km: number | null;
      interval_days: number | null;
      motorcycles: { name: string } | null;
    }>,
    photos: (photos.data ?? []) as Array<{
      id: string;
      caption: string;
      maintenance_records: {
        date: string;
        maintenance_type: string;
      } | null;
    }>,
  };
}
