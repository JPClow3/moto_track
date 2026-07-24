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

type Row = Record<string, unknown>;

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

function messageFrom(err: unknown) {
  return err instanceof Error ? err.message : String(err);
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
    const blocked = await assertCanCreateUpload(locals.db, user.id);
    if (blocked) return fail(403, { message: blocked });
    const uploaded = await uploadObjectFile({
      file: receipt,
      module: "fuel",
      ownerId: user.id,
      platform,
    });
    receiptFileKey = uploaded.objectKey;
    try {
      await locals.db`
        insert into object_files ${locals.db({
          owner_id: user.id,
          module: "fuel",
          source_table: "fuel_records",
          source_id: id,
          object_key: uploaded.objectKey,
          filename: uploaded.filename,
          content_type: uploaded.contentType,
          byte_size: uploaded.byteSize,
        })}
      `;
    } catch (err) {
      return fail(400, { message: messageFrom(err) });
    }
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

  try {
    await locals.db`
      insert into fuel_records ${locals.db(payload)}
    `;
  } catch (err) {
    return fail(400, { message: messageFrom(err) });
  }

  // Best-effort cache of the last-used fuel preferences for this combo. The
  // Supabase version never checked this upsert's result either, so failures
  // here are swallowed instead of failing the whole fill-up submission.
  try {
    await locals.db`
      insert into fuel_preferences ${locals.db({
        owner_id: user.id,
        motorcycle_id: payload.motorcycle_id,
        station_id: payload.station_id,
        fuel_grade_id: payload.fuel_grade_id,
        fuel_type: payload.fuel_type,
        station_name: payload.station_name,
        price_per_liter_millicents: payload.price_per_liter_millicents,
        tank_full: payload.tank_full,
        last_used_at: new Date().toISOString(),
      })}
      on conflict (owner_id, motorcycle_id, station_id, fuel_grade_id, fuel_type, station_name)
      do update set
        price_per_liter_millicents = excluded.price_per_liter_millicents,
        tank_full = excluded.tank_full,
        last_used_at = excluded.last_used_at
    `;
  } catch {
    // Ignored — see comment above.
  }

  if (payload.motorcycle_id) {
    await syncMotorcycleOdometer(locals.db, user.id, payload.motorcycle_id);
  }

  return { ok: true };
}

export async function load({ locals }) {
  const user = locals.user!;
  const [
    fuelResult,
    motorcycles,
    stations,
    grades,
    preferences,
    reviewPreferences,
  ] = await Promise.all([
    locals.db<Row[]>`
      select * from fuel_records
      where owner_id = ${user.id}
      order by date desc, odometer_km desc
    `.then(
      (rows) => ({ rows, error: null as string | null }),
      (err: unknown) => ({ rows: [] as Row[], error: messageFrom(err) }),
    ),
    locals.db<Row[]>`
      select id, name, current_odometer_km from motorcycles
      where owner_id = ${user.id} and is_active = true
      order by name
    `.catch(() => [] as Row[]),
    locals.db<Row[]>`
      select * from fuel_stations
      where owner_id = ${user.id}
      order by name
    `.catch(() => [] as Row[]),
    locals.db<Row[]>`
      select * from fuel_grades
      where owner_id = ${user.id}
      order by name
    `.catch(() => [] as Row[]),
    locals.db<Row[]>`
      select * from fuel_preferences
      where owner_id = ${user.id}
      order by last_used_at desc
    `.catch(() => [] as Row[]),
    locals.db<Row[]>`
      select * from fuel_review_preferences
      where owner_id = ${user.id}
    `.catch(() => [] as Row[]),
  ]);

  // Explicit generic on `.map` (rather than letting it infer): spreading a
  // `Record<string, unknown>` alongside a literal property otherwise makes TS
  // drop the index signature from the result, rejecting every other
  // `row.<column>` access below.
  const fuelRows = fuelResult.rows.map<Row & { liters: number }>((row) => ({
    ...row,
    liters: Number(row.liters),
  }));
  const totalSpend = fuelRows.reduce(
    (sum, row) => sum + Number(row.total_price_cents ?? 0),
    0,
  );

  return {
    errorMessage: fuelResult.error ?? "",
    rows: fuelRows,
    motorcycles,
    stations,
    grades,
    preferences,
    reviewPreferences,
    summary: {
      totalSpend,
      totalLiters: fuelRows.reduce(
        (sum, row) => sum + Number(row.liters ?? 0),
        0,
      ),
      averageConsumption: averageConsumption(fuelRows as never),
      costPerKm: costPerKm(fuelRows as never),
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
    const ownerId = locals.user!.id;
    let existing: { motorcycle_id: string | null } | undefined;
    try {
      [existing] = await locals.db<Array<{ motorcycle_id: string | null }>>`
        select motorcycle_id from fuel_records
        where owner_id = ${ownerId} and id = ${id}
      `;
    } catch (err) {
      return fail(400, { message: messageFrom(err) });
    }
    try {
      await locals.db`
        delete from fuel_records
        where owner_id = ${ownerId} and id = ${id}
      `;
    } catch (err) {
      return fail(400, { message: messageFrom(err) });
    }
    if (existing?.motorcycle_id) {
      await syncMotorcycleOdometer(locals.db, ownerId, existing.motorcycle_id);
    }
    return { ok: true };
  },
  repeatLast: async ({ request, locals, platform }) => {
    const form = await request.formData();
    let last: Row | undefined;
    try {
      [last] = await locals.db<Row[]>`
        select * from fuel_records
        where owner_id = ${locals.user!.id}
        order by date desc, odometer_km desc
        limit 1
      `;
    } catch (err) {
      return fail(400, { message: messageFrom(err) });
    }
    if (!last) {
      return fail(400, { message: "Sem abastecimento anterior." });
    }
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
    const ownerId = locals.user!.id;
    const motorcycleId = String(form.get("motorcycle_id") || "");
    try {
      await locals.db`
        insert into fuel_records ${locals.db(
          rows.map((row) => ({
            ...row,
            id: crypto.randomUUID(),
            owner_id: ownerId,
            motorcycle_id: motorcycleId || null,
          })),
        )}
      `;
    } catch (err) {
      return fail(400, { message: messageFrom(err) });
    }
    if (motorcycleId) {
      await syncMotorcycleOdometer(locals.db, ownerId, motorcycleId);
    }
    return { ok: true, imported: rows.length };
  },
  saveStation: async ({ request, locals }) => {
    const form = await request.formData();
    const id = String(form.get("id") ?? "");
    const ownerId = locals.user!.id;
    const payload = {
      owner_id: ownerId,
      name: String(form.get("name") ?? ""),
      brand: String(form.get("brand") ?? ""),
      city: String(form.get("city") ?? ""),
      state: String(form.get("state") ?? ""),
      notes: String(form.get("notes") ?? ""),
    };
    try {
      if (id) {
        await locals.db`
          update fuel_stations
          set ${locals.db(payload)}
          where id = ${id} and owner_id = ${ownerId}
        `;
      } else {
        await locals.db`
          insert into fuel_stations ${locals.db(payload)}
        `;
      }
    } catch (err) {
      return fail(400, { message: messageFrom(err) });
    }
    return { ok: true };
  },
  deleteStation: async ({ request, locals }) => {
    const form = await request.formData();
    try {
      await locals.db`
        delete from fuel_stations
        where id = ${String(form.get("id") ?? "")} and owner_id = ${locals.user!.id}
      `;
    } catch (err) {
      return fail(400, { message: messageFrom(err) });
    }
    return { ok: true };
  },
  saveGrade: async ({ request, locals }) => {
    const form = await request.formData();
    const id = String(form.get("id") ?? "");
    const ownerId = locals.user!.id;
    const payload = {
      owner_id: ownerId,
      name: String(form.get("name") ?? ""),
      fuel_type: String(form.get("fuel_type") ?? "gasoline"),
      octane_rating: Math.round(numberValue(form.get("octane_rating"))),
      ethanol_percentage: numberValue(form.get("ethanol_percentage")),
      default_price_per_liter_millicents: millicents(
        form.get("default_price_per_liter"),
      ),
      notes: String(form.get("notes") ?? ""),
    };
    try {
      if (id) {
        await locals.db`
          update fuel_grades
          set ${locals.db(payload)}
          where id = ${id} and owner_id = ${ownerId}
        `;
      } else {
        await locals.db`
          insert into fuel_grades ${locals.db(payload)}
        `;
      }
    } catch (err) {
      return fail(400, { message: messageFrom(err) });
    }
    return { ok: true };
  },
  deleteGrade: async ({ request, locals }) => {
    const form = await request.formData();
    try {
      await locals.db`
        delete from fuel_grades
        where id = ${String(form.get("id") ?? "")} and owner_id = ${locals.user!.id}
      `;
    } catch (err) {
      return fail(400, { message: messageFrom(err) });
    }
    return { ok: true };
  },
  saveDefaults: async ({ request, locals }) => {
    const form = await request.formData();
    const ownerId = locals.user!.id;
    try {
      await locals.db`
        insert into fuel_preferences ${locals.db({
          owner_id: ownerId,
          motorcycle_id: String(form.get("motorcycle_id") || "") || null,
          station_id: String(form.get("station_id") || "") || null,
          fuel_grade_id: String(form.get("fuel_grade_id") || "") || null,
          fuel_type: String(form.get("fuel_type") || "gasoline"),
          station_name: String(form.get("station_name") || ""),
          price_per_liter_millicents: millicents(form.get("price_per_liter")),
          tank_full: form.get("tank_full") === "true",
          last_used_at: new Date().toISOString(),
        })}
        on conflict (owner_id, motorcycle_id, station_id, fuel_grade_id, fuel_type, station_name)
        do update set
          price_per_liter_millicents = excluded.price_per_liter_millicents,
          tank_full = excluded.tank_full,
          last_used_at = excluded.last_used_at
      `;
    } catch (err) {
      return fail(400, { message: messageFrom(err) });
    }
    return { ok: true };
  },
  saveReviewSettings: async ({ request, locals }) => {
    const form = await request.formData();
    const ownerId = locals.user!.id;
    try {
      // `fuel_review_preferences` is unique on `motorcycle_id` alone, so the
      // `where` on the update guards against overwriting another owner's row
      // (there's no RLS backstop to fall back on anymore).
      await locals.db`
        insert into fuel_review_preferences ${locals.db({
          owner_id: ownerId,
          motorcycle_id: String(form.get("motorcycle_id") || ""),
          fillups_interval: Math.max(
            Math.round(numberValue(form.get("fillups_interval")) || 10),
            1,
          ),
          is_active: form.get("is_active") === "true",
        })}
        on conflict (motorcycle_id) do update set
          fillups_interval = excluded.fillups_interval,
          is_active = excluded.is_active
        where fuel_review_preferences.owner_id = ${ownerId}
      `;
    } catch (err) {
      return fail(400, { message: messageFrom(err) });
    }
    return { ok: true };
  },
};
