import { fail } from "@sveltejs/kit";
import { g as getFeature, s as schemaForFeature } from "./features.js";
import { u as uploadObjectFile } from "./files.js";
import { s as syncMotorcycleOdometer } from "./odometer.js";
function numberValue(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}
function stringValue(value) {
  return typeof value === "string" && value ? value : null;
}
function subtractDays(date, days) {
  const value = /* @__PURE__ */ new Date(`${date}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() - days);
  return value.toISOString().slice(0, 10);
}
function reminderForRecord(table, _recordId, payload) {
  if (!stringValue(payload.motorcycle_id)) return null;
  if (table === "maintenance_records") {
    const intervalKm = numberValue(payload.interval_km);
    const intervalDays = numberValue(payload.interval_days);
    const referenceKm = numberValue(payload.odometer_km);
    const referenceDate = stringValue(payload.date);
    if (!intervalKm && !intervalDays) return null;
    return {
      title: `Manutenção: ${stringValue(payload.maintenance_type) ?? "revisão"}`,
      trigger_type: intervalKm && intervalDays ? "by_interval" : intervalKm ? "by_km" : "by_date",
      trigger_value_km: intervalKm,
      trigger_value_days: intervalDays,
      reference_km: referenceKm,
      reference_date: referenceDate,
      is_recurring: true
    };
  }
  const isDocument = table === "motorcycle_documents";
  const isFee = table === "annual_fees";
  if (!isDocument && !isFee) return null;
  const dueDate = stringValue(payload[isDocument ? "valid_until" : "due_date"]);
  const noticeDays = numberValue(payload.notify_before_days) ?? 30;
  if (!dueDate) return null;
  return {
    title: isDocument ? `Documento vence: ${stringValue(payload.name) ?? "documento"}` : `Taxa vence: ${stringValue(payload.fee_type) ?? "taxa"}`,
    trigger_type: "by_date",
    trigger_value_km: null,
    trigger_value_days: 0,
    reference_km: null,
    reference_date: subtractDays(dueDate, noticeDays),
    is_recurring: false
  };
}
async function syncLinkedReminder(supabase, ownerId, table, recordId, payload) {
  const marker = `auto:${table}:${recordId}`;
  const reminder = reminderForRecord(table, recordId, payload);
  const { data: existing, error: readError } = await supabase.from("reminders").select("id").eq("owner_id", ownerId).eq("notes", marker).maybeSingle();
  if (readError) throw readError;
  if (!reminder) {
    if (existing) {
      const { error: error2 } = await supabase.from("reminders").delete().eq("id", existing.id).eq("owner_id", ownerId);
      if (error2) throw error2;
    }
    return;
  }
  const values = {
    owner_id: ownerId,
    motorcycle_id: String(payload.motorcycle_id),
    ...reminder,
    send_email: true,
    send_push: true,
    is_active: true,
    notes: marker
  };
  const { error } = existing ? await supabase.from("reminders").update(values).eq("id", existing.id).eq("owner_id", ownerId) : await supabase.from("reminders").insert(values);
  if (error) throw error;
}
function motorcycleIdFrom(payload) {
  const value = payload.motorcycle_id;
  return typeof value === "string" && value ? value : null;
}
async function syncRecordEffects({
  supabase,
  ownerId,
  feature,
  recordId,
  payload
}) {
  const motorcycleId = motorcycleIdFrom(payload);
  if (motorcycleId) {
    await syncMotorcycleOdometer(supabase, ownerId, motorcycleId);
  }
  await syncLinkedReminder(supabase, ownerId, feature.table, recordId, payload);
}
function normalizeFeaturePayload(feature, formData, user) {
  const raw = {};
  for (const field of feature.fields) {
    if (field.kind === "file") continue;
    const formValue = formData.get(field.key);
    if (field.kind === "boolean") {
      raw[field.key] = formValue === "true";
    } else {
      raw[field.key] = formValue ?? "";
    }
  }
  const parsed = schemaForFeature(feature).safeParse(raw);
  if (!parsed.success) {
    return { ok: false, errors: parsed.error.flatten().fieldErrors };
  }
  const payload = {};
  for (const field of feature.fields) {
    if (field.kind === "file") continue;
    const value = parsed.data[field.key];
    if (value === "" || value === void 0) continue;
    if (field.kind === "money") {
      if (field.key.endsWith("_millicents")) {
        payload[field.key] = Math.round(Number(value) * 1e5);
      } else {
        payload[field.key] = Math.round(Number(value) * 100);
      }
    } else {
      payload[field.key] = value;
    }
  }
  if (feature.ownerScoped) {
    payload.owner_id = user.id;
  }
  payload.updated_at = (/* @__PURE__ */ new Date()).toISOString();
  return { ok: true, payload };
}
async function loadFeature(supabase, slug, user) {
  const feature = getFeature(slug);
  const [column, direction = "asc"] = feature.orderBy.split(".");
  const db = supabase;
  let query = db.from(feature.table).select("*").order(column, { ascending: direction !== "desc" }).limit(100);
  if (feature.ownerScoped) {
    query = query.eq("owner_id", user.id);
  }
  const [{ data, error }, { data: motorcycles, error: motorcyclesError }] = await Promise.all([
    query,
    supabase.from("motorcycles").select("id, name, brand, model").eq("owner_id", user.id).eq("is_active", true).is("deleted_at", null).order("name")
  ]);
  return {
    feature,
    rows: data ?? [],
    motorcycles: motorcycles ?? [],
    errorMessage: error?.message ?? motorcyclesError?.message ?? ""
  };
}
function featureActions(slug) {
  return {
    default: async ({ request, locals, platform }) => {
      if (!locals.user) {
        return fail(401, { message: "Authentication required." });
      }
      const feature = getFeature(slug);
      const formData = await request.formData();
      const intent = String(formData.get("_intent") ?? "create");
      const id = String(formData.get("id") ?? "");
      if (intent === "delete") {
        if (!id) return fail(400, { message: "Missing record id." });
        const db = locals.supabase;
        const { data: existing, error: readError } = await db.from(feature.table).select("motorcycle_id").eq("id", id).eq("owner_id", locals.user.id).maybeSingle();
        if (readError) return fail(400, { message: readError.message });
        const { error: error2 } = await db.from(feature.table).delete().eq("id", id).eq("owner_id", locals.user.id);
        if (error2) return fail(400, { message: error2.message });
        await syncLinkedReminder(
          locals.supabase,
          locals.user.id,
          feature.table,
          id,
          {}
        );
        const motorcycleId = motorcycleIdFrom(
          existing ?? {}
        );
        if (motorcycleId) {
          await syncMotorcycleOdometer(
            locals.supabase,
            locals.user.id,
            motorcycleId
          );
        }
        return { ok: true };
      }
      const normalized = normalizeFeaturePayload(
        feature,
        formData,
        locals.user
      );
      if (!normalized.ok) {
        return fail(400, {
          message: "Invalid form data.",
          errors: normalized.errors
        });
      }
      const payload = normalized.payload;
      const recordId = intent === "update" && id ? id : String(payload.id ?? crypto.randomUUID());
      payload.id = recordId;
      for (const field of feature.fields.filter(
        (item) => item.kind === "file"
      )) {
        const file = formData.get(field.key);
        if (!(file instanceof File) || file.size === 0) continue;
        const uploaded = await uploadObjectFile({
          file,
          module: feature.slug,
          ownerId: locals.user.id,
          platform
        });
        payload[field.key] = uploaded.objectKey;
        const { error: fileError } = await locals.supabase.from("object_files").insert({
          owner_id: locals.user.id,
          module: feature.slug,
          source_table: feature.table,
          source_id: recordId,
          object_key: uploaded.objectKey,
          filename: uploaded.filename,
          content_type: uploaded.contentType,
          byte_size: uploaded.byteSize
        });
        if (fileError) return fail(400, { message: fileError.message });
      }
      const query = intent === "update" && id ? locals.supabase.from(feature.table).update(payload).eq("id", id).eq("owner_id", locals.user.id) : locals.supabase.from(feature.table).insert(payload);
      const { error } = await query;
      if (error) {
        return fail(400, { message: error.message });
      }
      await syncRecordEffects({
        supabase: locals.supabase,
        ownerId: locals.user.id,
        feature,
        recordId,
        payload
      });
      return { ok: true };
    }
  };
}
export {
  featureActions as f,
  loadFeature as l
};
