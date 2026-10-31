import { localizedActions } from "$server/domain/localized-actions";
import { fail, type Actions } from "@sveltejs/kit";
import {
  averageConsumption,
  costPerKm,
  parseDecimalInput,
  parseFuelImportRows,
  parseIntegerInput,
  parseLocalizedNumber,
  parseFuelCsv,
  parseReceiptFile,
} from "$server/domain/fuel";
import { consumptionTrend } from "$server/domain/dashboard";
import {
  MAX_RECEIPT_UPLOAD_BYTES,
  RECEIPT_UPLOAD_CONTENT_TYPES,
  deleteQueuedObjectsBestEffort,
  enqueueObjectDeletions,
  lockObjectOwner,
  queueUploadedOrphansBestEffort,
  uploadObjectFile,
  validateObjectUpload,
} from "$server/r2/files";
import { runtimeEnv } from "$server/runtime";
import { syncMotorcycleOdometer } from "$server/domain/odometer";
import { assertCanCreateUpload } from "$server/domain/entitlement-guards";
import { assertOwnedFuelReferences } from "$server/domain/fuel-reference-guards";
import { assertOwnedMotorcycleReference } from "$server/domain/crud";
import {
  matchesFuelReplay,
  offlineFuelId,
  OfflineFuelConflict,
  offlineFuelFingerprint,
  resolveOfflineFuelSubmission,
  acceptOfflineFuelSubmission,
} from "$server/domain/offline-fuel-replay";

import { appToday } from "$lib/utils/calendar-day";
type Row = Record<string, unknown>;

// Riders type "4,59" (pt-BR) as often as "4.59"; decimal fields are text
// inputs, so every amount goes through the localized parser.
function cents(value: FormDataEntryValue | null) {
  return Math.round(parseDecimalInput(value) * 100);
}

function millicents(value: FormDataEntryValue | null) {
  return Math.round(parseDecimalInput(value) * 100000);
}

function numberValue(value: FormDataEntryValue | null) {
  return parseDecimalInput(value);
}

function integerValue(value: FormDataEntryValue | null) {
  return parseIntegerInput(value);
}

function coordinateValue(value: string, limit: number) {
  if (!value) return null;
  const parsed = parseLocalizedNumber(value);
  return parsed !== null && Math.abs(parsed) <= limit ? parsed : Number.NaN;
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
  const offlineRequested = form.has("offline_submission_id");
  const offlineId = offlineFuelId(form.get("offline_submission_id"));
  const offlineConflict = () =>
    fail(409, {
      message:
        "Não foi possível confirmar este envio offline. Atualize a página e revise o registro.",
    });
  if (
    offlineRequested &&
    (!offlineId || form.get("offline_owner_id") !== user.id)
  )
    return offlineConflict();
  const id = offlineId ?? crypto.randomUUID();
  const receipt = form.get("receipt_file");
  if (
    offlineRequested &&
    [...form.values()].some((value) => value instanceof File && value.size > 0)
  ) {
    return fail(400, {
      message:
        "Envios offline não aceitam arquivos. Envie o comprovante quando estiver online.",
    });
  }
  let receiptFileKey = "";
  let uploadedReceipt:
    | {
        objectKey: string;
        filename: string;
        contentType: string;
        byteSize: number;
      }
    | undefined;
  if (receipt instanceof File && receipt.size > 0) {
    const validation = await validateObjectUpload(receipt, {
      maxBytes: MAX_RECEIPT_UPLOAD_BYTES,
      allowedContentTypes: RECEIPT_UPLOAD_CONTENT_TYPES,
    });
    if (!validation.ok) return fail(400, { message: validation.message });
    const blocked = await assertCanCreateUpload(locals.db, user.id, platform);
    if (blocked) return fail(403, { message: blocked });
    try {
      uploadedReceipt = await uploadObjectFile({
        file: receipt,
        module: "fuel",
        ownerId: user.id,
        platform,
        policy: {
          maxBytes: MAX_RECEIPT_UPLOAD_BYTES,
          allowedContentTypes: RECEIPT_UPLOAD_CONTENT_TYPES,
        },
      });
    } catch (err) {
      return fail(400, { message: messageFrom(err) });
    }
    receiptFileKey = uploadedReceipt.objectKey;
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
    date: String(form.get("date") || appToday()),
    odometer_km: integerValue(form.get("odometer_km")),
    liters,
    total_price_cents: totalCents,
    price_per_liter_millicents: pricePerLiter,
    fuel_type: String(form.get("fuel_type") || "gasoline"),
    tank_full: form.get("tank_full") === "true",
    station_name: String(form.get("station_name") || ""),
    notes: String(form.get("notes") || ""),
    receipt_file_key: receiptFileKey || null,
  };

  let inserted = true;
  try {
    const fingerprint = offlineId
      ? await offlineFuelFingerprint(payload)
      : null;
    inserted = await locals.db.begin(async (transaction) => {
      const db = transaction as unknown as typeof locals.db;
      await lockObjectOwner(db, user.id);
      if (
        offlineId &&
        (await resolveOfflineFuelSubmission(
          db,
          user.id,
          payload,
          fingerprint!,
        )) === "accepted"
      )
        return false;
      await assertOwnedFuelReferences(db, user.id, payload);
      if (offlineId) {
        const rows = await db<
          Array<{ id: string }>
        >`insert into fuel_records ${db(payload)} on conflict (id) do nothing returning id`;
        if (!rows.length) {
          const [existing] = await db<
            Row[]
          >`select *, date::text as date from fuel_records where id = ${id}`;
          if (!existing || !matchesFuelReplay(existing, payload))
            throw new OfflineFuelConflict();
          await acceptOfflineFuelSubmission(db, user.id, id, fingerprint!);
          return false;
        }
      } else {
        await db`insert into fuel_records ${db(payload)}`;
      }
      if (uploadedReceipt) {
        await db`
          insert into object_files ${db({
            owner_id: user.id,
            module: "fuel",
            source_table: "fuel_records",
            source_id: id,
            object_key: uploadedReceipt.objectKey,
            filename: uploadedReceipt.filename,
            content_type: uploadedReceipt.contentType,
            byte_size: uploadedReceipt.byteSize,
          })}
        `;
      }
      if (offlineId)
        await acceptOfflineFuelSubmission(db, user.id, id, fingerprint!);
      if (payload.motorcycle_id)
        await syncMotorcycleOdometer(db, user.id, payload.motorcycle_id, {
          strict: true,
        });
      return true;
    });
  } catch (err) {
    if (err instanceof OfflineFuelConflict) return offlineConflict();
    await queueUploadedOrphansBestEffort({
      db: locals.db,
      objectKeys: uploadedReceipt ? [uploadedReceipt.objectKey] : [],
      ownerId: user.id,
      platform,
    });
    return fail(400, { message: messageFrom(err) });
  }

  // A replay acknowledges the original commit without repeating side effects.
  if (!inserted) return { ok: true, offlineSubmissionId: id };

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

  return offlineId ? { ok: true, offlineSubmissionId: id } : { ok: true };
}

export async function load({ locals, parent }) {
  const user = locals.user!;
  // Awaiting parent() makes this load re-run after a bike switch.
  const { activeMotorcycleId } = await parent();
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
      where owner_id = ${user.id} and is_active = true and deleted_at is null
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
  const defaultMotorcycleId =
    motorcycles.find((moto) => String(moto.id) === activeMotorcycleId)?.id ??
    motorcycles[0]?.id ??
    null;

  // The shell's bike switcher is the page's only bike context: with more
  // than one bike, the list, signals and chart all follow the active bike.
  // Fill-ups never linked to a bike (legacy imports) stay visible on every
  // bike rather than disappearing.
  const scopedRows =
    motorcycles.length > 1 && defaultMotorcycleId
      ? fuelResult.rows.filter(
          (row) =>
            row.motorcycle_id == null ||
            String(row.motorcycle_id) === String(defaultMotorcycleId),
        )
      : fuelResult.rows;
  const fuelRows = scopedRows.map<Row & { liters: number }>((row) => ({
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
    /** The shell's active bike, else the first one: the page's default view. */
    activeMotorcycleId: defaultMotorcycleId
      ? String(defaultMotorcycleId)
      : null,
    stations,
    grades,
    preferences,
    reviewPreferences,
    // Same methodology as the dashboard trend, but surfaced where the rider
    // actually enters fill-ups so the feedback loop is immediate.
    consumption: consumptionTrend(fuelRows as never).map((point) => ({
      date: point.date,
      value: point.kmPerLiter,
    })),
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

export const actions: Actions = localizedActions({
  createRecord: async ({ request, locals, platform }) => {
    return createFuelRecord({
      form: await request.formData(),
      locals,
      platform,
    });
  },
  deleteRecord: async ({ request, locals, platform }) => {
    const form = await request.formData();
    const id = String(form.get("id") ?? "");
    const ownerId = locals.user!.id;
    let deleted:
      | {
          existing: { motorcycle_id: string | null } | undefined;
          objectKeys: string[];
        }
      | undefined;
    try {
      deleted = await locals.db.begin(async (transaction) => {
        const db = transaction as unknown as typeof locals.db;
        await lockObjectOwner(db, ownerId);
        const [existing] = await db<Array<{ motorcycle_id: string | null }>>`
          select motorcycle_id from fuel_records
          where owner_id = ${ownerId} and id = ${id}
          for update
        `;
        if (!existing) return { existing, objectKeys: [] };
        const files = await db<Array<{ object_key: string }>>`
          select object_key from object_files
          where owner_id = ${ownerId}
            and source_table = 'fuel_records'
            and source_id = ${id}
        `;
        await enqueueObjectDeletions(
          db,
          ownerId,
          files.map((file) => file.object_key),
        );
        await db`
          delete from fuel_records
          where owner_id = ${ownerId} and id = ${id}
        `;
        await db`
          delete from object_files
          where owner_id = ${ownerId}
            and source_table = 'fuel_records'
            and source_id = ${id}
        `;
        if (existing.motorcycle_id)
          await syncMotorcycleOdometer(db, ownerId, existing.motorcycle_id, {
            strict: true,
          });
        return {
          existing,
          objectKeys: files.map((file) => file.object_key),
        };
      });
    } catch (err) {
      return fail(400, { message: messageFrom(err) });
    }
    await deleteQueuedObjectsBestEffort({
      db: locals.db,
      objectKeys: deleted.objectKeys,
      ownerId,
      platform,
    });
    return { ok: true };
  },
  updateRecord: async ({ request, locals }) => {
    const form = await request.formData();
    const id = String(form.get("id") ?? "");
    const ownerId = locals.user!.id;
    const totalCents = cents(form.get("total_price"));
    const liters = numberValue(form.get("liters"));
    const payload = {
      motorcycle_id: String(form.get("motorcycle_id") || "") || null,
      station_id: String(form.get("station_id") || "") || null,
      fuel_grade_id: String(form.get("fuel_grade_id") || "") || null,
      date: String(form.get("date") || appToday()),
      odometer_km: integerValue(form.get("odometer_km")),
      liters,
      total_price_cents: totalCents,
      price_per_liter_millicents:
        liters > 0 ? Math.round((totalCents / 100 / liters) * 100000) : 0,
      fuel_type: String(form.get("fuel_type") || "gasoline"),
      tank_full: form.get("tank_full") === "true",
      station_name: String(form.get("station_name") || ""),
      notes: String(form.get("notes") || ""),
      updated_at: new Date().toISOString(),
    };
    try {
      const updated = await locals.db.begin(async (transaction) => {
        const db = transaction as unknown as typeof locals.db;
        await lockObjectOwner(db, ownerId);
        const [existing] = await db<Array<{ motorcycle_id: string | null }>>`
          select motorcycle_id from fuel_records
          where owner_id = ${ownerId} and id = ${id}
          for update
        `;
        if (!existing) return false;
        await assertOwnedFuelReferences(db, ownerId, payload);
        await db`
          update fuel_records set ${db(payload)}
          where owner_id = ${ownerId} and id = ${id}
        `;
        // Moving a fill-up to another bike changes both bikes' odometers.
        for (const motorcycleId of new Set([
          existing.motorcycle_id,
          payload.motorcycle_id,
        ])) {
          if (motorcycleId)
            await syncMotorcycleOdometer(db, ownerId, motorcycleId, {
              strict: true,
            });
        }
        return true;
      });
      if (!updated) return fail(404, { message: "Registro não encontrado." });
    } catch (err) {
      return fail(400, { message: messageFrom(err) });
    }
    return { ok: true };
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
      await locals.db.begin(async (transaction) => {
        const db = transaction as unknown as typeof locals.db;
        await lockObjectOwner(db, ownerId);
        await assertOwnedMotorcycleReference(db, ownerId, motorcycleId || null);
        await db`
        insert into fuel_records ${db(
          rows.map((row) => ({
            ...row,
            id: crypto.randomUUID(),
            owner_id: ownerId,
            motorcycle_id: motorcycleId || null,
          })),
        )}
      `;
        if (motorcycleId)
          await syncMotorcycleOdometer(db, ownerId, motorcycleId, {
            strict: true,
          });
      });
    } catch (err) {
      return fail(400, { message: messageFrom(err) });
    }
    return { ok: true, imported: rows.length };
  },
  saveStation: async ({ request, locals }) => {
    const form = await request.formData();
    const id = String(form.get("id") ?? "");
    const ownerId = locals.user!.id;
    const latitude = String(form.get("latitude") ?? "").trim();
    const longitude = String(form.get("longitude") ?? "").trim();
    const latitudeValue = coordinateValue(latitude, 90);
    const longitudeValue = coordinateValue(longitude, 180);
    if (
      Boolean(latitude) !== Boolean(longitude) ||
      Number.isNaN(latitudeValue) ||
      Number.isNaN(longitudeValue)
    ) {
      return fail(400, {
        message: "Informe latitude e longitude válidas, ou deixe ambas vazias.",
      });
    }
    const payload = {
      owner_id: ownerId,
      name: String(form.get("name") ?? ""),
      brand: String(form.get("brand") ?? ""),
      city: String(form.get("city") ?? ""),
      state: String(form.get("state") ?? ""),
      notes: String(form.get("notes") ?? ""),
      latitude: latitudeValue,
      longitude: longitudeValue,
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
      octane_rating: integerValue(form.get("octane_rating")),
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
      await locals.db.begin(async (transaction) => {
        const db = transaction as unknown as typeof locals.db;
        await lockObjectOwner(db, ownerId);
        await assertOwnedFuelReferences(db, ownerId, {
          motorcycle_id: String(form.get("motorcycle_id") || "") || null,
          station_id: String(form.get("station_id") || "") || null,
          fuel_grade_id: String(form.get("fuel_grade_id") || "") || null,
        });
        await db`
        insert into fuel_preferences ${db({
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
      });
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
      await locals.db.begin(async (transaction) => {
        const db = transaction as unknown as typeof locals.db;
        await lockObjectOwner(db, ownerId);
        await assertOwnedMotorcycleReference(
          db,
          ownerId,
          String(form.get("motorcycle_id") || ""),
          { required: true },
        );
        await db`
        insert into fuel_review_preferences ${db({
          owner_id: ownerId,
          motorcycle_id: String(form.get("motorcycle_id") || ""),
          fillups_interval: Math.max(
            integerValue(form.get("fillups_interval")) || 10,
            1,
          ),
          is_active: form.get("is_active") === "true",
        })}
        on conflict (motorcycle_id) do update set
          fillups_interval = excluded.fillups_interval,
          is_active = excluded.is_active
        where fuel_review_preferences.owner_id = ${ownerId}
      `;
      });
    } catch (err) {
      return fail(400, { message: messageFrom(err) });
    }
    return { ok: true };
  },
});
