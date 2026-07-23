import { fail, type Actions } from "@sveltejs/kit";
import {
  averageConsumption,
  costPerKm,
  parseFuelImportRows,
  parseFuelCsv,
  parseReceiptFile,
} from "$server/domain/fuel";
import { uploadObjectFile } from "$server/r2/files";
import { runtimeEnv } from "$server/runtime";
import { syncMotorcycleOdometer } from "$server/domain/odometer";
import { assertCanCreateUpload } from "$server/domain/entitlement-guards";

function cents(value: FormDataEntryValue | null) {
  const parsed = Number(String(value ?? "0").replace(",", "."));
  return Number.isFinite(parsed) ? Math.round(parsed * 100) : 0;
}

function millicents(value: FormDataEntryValue | null) {
  const parsed = Number(String(value ?? "0").replace(",", "."));
  return Number.isFinite(parsed) ? Math.round(parsed * 100000) : 0;
}

function numberValue(value: FormDataEntryValue | null) {
  const parsed = Number(String(value ?? "0").replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
}

async function createFuelRecord({
  form,
  locals,
  platform,
}: {
  form: FormData;
  locals: App.Locals;
  platform: App.Platform | undefined;
}) {
  const user = locals.user!;
  const id = crypto.randomUUID();
  const receipt = form.get("receipt_file");
  let receiptFileKey = "";
  if (receipt instanceof File && receipt.size > 0) {
    const blocked = await assertCanCreateUpload(locals.supabase, user.id);
    if (blocked) return fail(403, { message: blocked });
    const uploaded = await uploadObjectFile({
      file: receipt,
      module: "fuel",
      ownerId: user.id,
      platform,
    });
    receiptFileKey = uploaded.objectKey;
    const { error: fileError } = await locals.supabase
      .from("object_files")
      .insert({
        owner_id: user.id,
        module: "fuel",
        source_table: "fuel_records",
        source_id: id,
        object_key: uploaded.objectKey,
        filename: uploaded.filename,
        content_type: uploaded.contentType,
        byte_size: uploaded.byteSize,
      });
    if (fileError) return fail(400, { message: fileError.message });
  }

  const totalCents = cents(form.get("total_price"));
  const liters = numberValue(form.get("liters"));
  const pricePerLiter =
    millicents(form.get("price_per_liter")) ||
    (liters > 0 ? Math.round((totalCents / 100 / liters) * 100000) : 0);

  const payload = {
    id,
    owner_id: user.id,
    motorcycle_id: String(form.get("motorcycle_id") || "") || null,
    station_id: String(form.get("station_id") || "") || null,
    fuel_grade_id: String(form.get("fuel_grade_id") || "") || null,
    date: String(form.get("date") || new Date().toISOString().slice(0, 10)),
    odometer_km: Math.round(numberValue(form.get("odometer_km"))),
    liters,
    total_price_cents: totalCents,
    price_per_liter_millicents: pricePerLiter,
    fuel_type: String(form.get("fuel_type") || "gasoline"),
    tank_full: form.get("tank_full") === "true",
    station_name: String(form.get("station_name") || ""),
    notes: String(form.get("notes") || ""),
    receipt_file_key: receiptFileKey || null,
  };

  const { error } = await locals.supabase.from("fuel_records").insert(payload);
  if (error) return fail(400, { message: error.message });

  await locals.supabase.from("fuel_preferences").upsert(
    {
      owner_id: user.id,
      motorcycle_id: payload.motorcycle_id,
      station_id: payload.station_id,
      fuel_grade_id: payload.fuel_grade_id,
      fuel_type: payload.fuel_type,
      station_name: payload.station_name,
      price_per_liter_millicents: payload.price_per_liter_millicents,
      tank_full: payload.tank_full,
      last_used_at: new Date().toISOString(),
    },
    {
      onConflict:
        "owner_id,motorcycle_id,station_id,fuel_grade_id,fuel_type,station_name",
    },
  );

  if (payload.motorcycle_id) {
    await syncMotorcycleOdometer(
      locals.supabase,
      user.id,
      payload.motorcycle_id,
    );
  }

  return { ok: true };
}

export async function load({ locals }) {
  const user = locals.user!;
  const [
    { data: rows, error },
    { data: motorcycles },
    { data: stations },
    { data: grades },
    { data: preferences },
    { data: reviewPreferences },
  ] = await Promise.all([
    locals.supabase
      .from("fuel_records")
      .select("*")
      .eq("owner_id", user.id)
      .order("date", { ascending: false })
      .order("odometer_km", { ascending: false }),
    locals.supabase
      .from("motorcycles")
      .select("id, name, current_odometer_km")
      .eq("owner_id", user.id)
      .eq("is_active", true)
      .order("name"),
    locals.supabase
      .from("fuel_stations")
      .select("*")
      .eq("owner_id", user.id)
      .order("name"),
    locals.supabase
      .from("fuel_grades")
      .select("*")
      .eq("owner_id", user.id)
      .order("name"),
    locals.supabase
      .from("fuel_preferences")
      .select("*")
      .eq("owner_id", user.id)
      .order("last_used_at", { ascending: false }),
    locals.supabase
      .from("fuel_review_preferences")
      .select("*")
      .eq("owner_id", user.id),
  ]);

  const fuelRows = (rows ?? []).map((row) => ({
    ...row,
    liters: Number(row.liters),
  }));
  const totalSpend = fuelRows.reduce(
    (sum, row) => sum + Number(row.total_price_cents ?? 0),
    0,
  );

  return {
    errorMessage: error?.message ?? "",
    rows: fuelRows,
    motorcycles: motorcycles ?? [],
    stations: stations ?? [],
    grades: grades ?? [],
    preferences: preferences ?? [],
    reviewPreferences: reviewPreferences ?? [],
    summary: {
      totalSpend,
      totalLiters: fuelRows.reduce(
        (sum, row) => sum + Number(row.liters ?? 0),
        0,
      ),
      averageConsumption: averageConsumption(fuelRows),
      costPerKm: costPerKm(fuelRows),
      lastRecord: fuelRows[0] ?? null,
    },
  };
}

export const actions: Actions = {
  createRecord: async ({ request, locals, platform }) => {
    return createFuelRecord({
      form: await request.formData(),
      locals,
      platform,
    });
  },
  deleteRecord: async ({ request, locals }) => {
    const form = await request.formData();
    const id = String(form.get("id") ?? "");
    const { data: existing, error: readError } = await locals.supabase
      .from("fuel_records")
      .select("motorcycle_id")
      .eq("owner_id", locals.user!.id)
      .eq("id", id)
      .maybeSingle();
    if (readError) return fail(400, { message: readError.message });
    const { error } = await locals.supabase
      .from("fuel_records")
      .delete()
      .eq("owner_id", locals.user!.id)
      .eq("id", id);
    if (error) return fail(400, { message: error.message });
    if (existing?.motorcycle_id) {
      await syncMotorcycleOdometer(
        locals.supabase,
        locals.user!.id,
        existing.motorcycle_id,
      );
    }
    return { ok: true };
  },
  repeatLast: async ({ request, locals, platform }) => {
    const form = await request.formData();
    const { data: last, error } = await locals.supabase
      .from("fuel_records")
      .select("*")
      .eq("owner_id", locals.user!.id)
      .order("date", { ascending: false })
      .order("odometer_km", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error || !last)
      return fail(400, {
        message: error?.message ?? "Sem abastecimento anterior.",
      });
    form.set("motorcycle_id", String(last.motorcycle_id ?? ""));
    form.set("station_id", String(last.station_id ?? ""));
    form.set("fuel_grade_id", String(last.fuel_grade_id ?? ""));
    form.set("fuel_type", String(last.fuel_type ?? "gasoline"));
    form.set("tank_full", String(last.tank_full ?? false));
    form.set("station_name", String(last.station_name ?? ""));
    form.set(
      "price_per_liter",
      String(Number(last.price_per_liter_millicents ?? 0) / 100000),
    );
    return createFuelRecord({ form, locals, platform });
  },
  ocrScan: async ({ request, platform }) => {
    const form = await request.formData();
    const file = form.get("receipt_file");
    if (!(file instanceof File) || file.size === 0) {
      return fail(400, { message: "Envie um comprovante para escanear." });
    }
    try {
      return {
        ocr: await parseReceiptFile(file, {
          apiKey: runtimeEnv(platform).MISTRAL_API_KEY,
        }),
      };
    } catch (cause) {
      const message =
        cause instanceof Error
          ? cause.message
          : "Não foi possível ler o comprovante.";
      return fail(400, { message });
    }
  },
  importPreview: async ({ request }) => {
    const form = await request.formData();
    const file = form.get("csv_file");
    if (!(file instanceof File) || file.size === 0) {
      return fail(400, { message: "Envie um CSV." });
    }
    const preview = parseFuelCsv(await file.text());
    return {
      previewRows: preview,
      validRowsJson: JSON.stringify(
        preview.filter((row) => row.errors.length === 0).map((row) => row.data),
      ),
    };
  },
  importConfirm: async ({ request, locals }) => {
    const form = await request.formData();
    const parsedRows = parseFuelImportRows(String(form.get("rows_json") ?? ""));
    if (!parsedRows.ok) return fail(400, { message: parsedRows.message });
    const rows = parsedRows.rows;
    const { error } = await locals.supabase.from("fuel_records").insert(
      rows.map((row) => ({
        ...row,
        id: crypto.randomUUID(),
        owner_id: locals.user!.id,
        motorcycle_id: String(form.get("motorcycle_id") || "") || null,
      })) as never,
    );
    if (error) return fail(400, { message: error.message });
    const motorcycleId = String(form.get("motorcycle_id") || "");
    if (motorcycleId) {
      await syncMotorcycleOdometer(
        locals.supabase,
        locals.user!.id,
        motorcycleId,
      );
    }
    return { ok: true, imported: rows.length };
  },
  saveStation: async ({ request, locals }) => {
    const form = await request.formData();
    const id = String(form.get("id") ?? "");
    const payload = {
      owner_id: locals.user!.id,
      name: String(form.get("name") ?? ""),
      brand: String(form.get("brand") ?? ""),
      city: String(form.get("city") ?? ""),
      state: String(form.get("state") ?? ""),
      notes: String(form.get("notes") ?? ""),
    };
    const query = id
      ? locals.supabase
          .from("fuel_stations")
          .update(payload)
          .eq("id", id)
          .eq("owner_id", locals.user!.id)
      : locals.supabase.from("fuel_stations").insert(payload);
    const { error } = await query;
    if (error) return fail(400, { message: error.message });
    return { ok: true };
  },
  deleteStation: async ({ request, locals }) => {
    const form = await request.formData();
    const { error } = await locals.supabase
      .from("fuel_stations")
      .delete()
      .eq("id", String(form.get("id") ?? ""))
      .eq("owner_id", locals.user!.id);
    if (error) return fail(400, { message: error.message });
    return { ok: true };
  },
  saveGrade: async ({ request, locals }) => {
    const form = await request.formData();
    const id = String(form.get("id") ?? "");
    const payload = {
      owner_id: locals.user!.id,
      name: String(form.get("name") ?? ""),
      fuel_type: String(form.get("fuel_type") ?? "gasoline"),
      octane_rating: Math.round(numberValue(form.get("octane_rating"))),
      ethanol_percentage: numberValue(form.get("ethanol_percentage")),
      default_price_per_liter_millicents: millicents(
        form.get("default_price_per_liter"),
      ),
      notes: String(form.get("notes") ?? ""),
    };
    const query = id
      ? locals.supabase
          .from("fuel_grades")
          .update(payload)
          .eq("id", id)
          .eq("owner_id", locals.user!.id)
      : locals.supabase.from("fuel_grades").insert(payload);
    const { error } = await query;
    if (error) return fail(400, { message: error.message });
    return { ok: true };
  },
  deleteGrade: async ({ request, locals }) => {
    const form = await request.formData();
    const { error } = await locals.supabase
      .from("fuel_grades")
      .delete()
      .eq("id", String(form.get("id") ?? ""))
      .eq("owner_id", locals.user!.id);
    if (error) return fail(400, { message: error.message });
    return { ok: true };
  },
  saveDefaults: async ({ request, locals }) => {
    const form = await request.formData();
    const { error } = await locals.supabase.from("fuel_preferences").upsert(
      {
        owner_id: locals.user!.id,
        motorcycle_id: String(form.get("motorcycle_id") || "") || null,
        station_id: String(form.get("station_id") || "") || null,
        fuel_grade_id: String(form.get("fuel_grade_id") || "") || null,
        fuel_type: String(form.get("fuel_type") || "gasoline"),
        station_name: String(form.get("station_name") || ""),
        price_per_liter_millicents: millicents(form.get("price_per_liter")),
        tank_full: form.get("tank_full") === "true",
        last_used_at: new Date().toISOString(),
      },
      {
        onConflict:
          "owner_id,motorcycle_id,station_id,fuel_grade_id,fuel_type,station_name",
      },
    );
    if (error) return fail(400, { message: error.message });
    return { ok: true };
  },
  saveReviewSettings: async ({ request, locals }) => {
    const form = await request.formData();
    const { error } = await locals.supabase
      .from("fuel_review_preferences")
      .upsert({
        owner_id: locals.user!.id,
        motorcycle_id: String(form.get("motorcycle_id") || ""),
        fillups_interval: Math.max(
          Math.round(numberValue(form.get("fillups_interval")) || 10),
          1,
        ),
        is_active: form.get("is_active") === "true",
      });
    if (error) return fail(400, { message: error.message });
    return { ok: true };
  },
};
