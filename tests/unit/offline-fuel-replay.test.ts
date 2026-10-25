import { beforeEach, describe, expect, it, vi } from "vitest";
import type { RequestEvent } from "@sveltejs/kit";
import {
  matchesFuelReplay,
  offlineFuelId,
  offlineFuelFingerprint,
} from "$server/domain/offline-fuel-replay";
import { actions } from "../../src/routes/(app)/fuel/+page.server";

const effects = vi.hoisted(() => ({
  upload: vi.fn(),
  quota: vi.fn(),
  odometer: vi.fn(),
}));
vi.mock("$server/runtime", () => ({ runtimeEnv: () => ({}) }));
vi.mock("$server/domain/odometer", () => ({
  syncMotorcycleOdometer: effects.odometer,
}));
vi.mock("$server/domain/entitlement-guards", () => ({
  assertCanCreateUpload: effects.quota,
}));
vi.mock("$server/r2/files", () => ({
  MAX_RECEIPT_UPLOAD_BYTES: 10_000_000,
  RECEIPT_UPLOAD_CONTENT_TYPES: [],
  deleteQueuedObjectsBestEffort: vi.fn(),
  enqueueObjectDeletions: vi.fn(),
  lockObjectOwner: vi.fn(),
  queueUploadedOrphansBestEffort: vi.fn(),
  uploadObjectFile: effects.upload,
  validateObjectUpload: vi.fn(),
}));

const id = "f03ec98b-6c67-45f9-8fbb-e95857c3d01c";
const ownerId = "3c3278f5-2954-40a3-8a70-58ad56f53dce";
const bikeId = "171ef427-250b-4cbd-8d2e-de8f56b67bf4";
function database(race = false) {
  const rows = new Map<string, Record<string, unknown>>();
  const receipts = new Map<string, Record<string, unknown>>();
  let inserts = 0,
    preferences = 0;
  const sql = Object.assign(
    (input: unknown, ...values: unknown[]) => {
      if (!Array.isArray(input)) return input;
      const text = input.join("?");
      if (
        text.includes(
          "select owner_id, payload_fingerprint from offline_fuel_submissions",
        )
      )
        return Promise.resolve(
          receipts.has(String(values[0]))
            ? [receipts.get(String(values[0]))]
            : [],
        );
      if (text.includes("insert into offline_fuel_submissions")) {
        if (receipts.has(String(values[0]))) return Promise.resolve([]);
        receipts.set(String(values[0]), {
          id: values[0],
          owner_id: values[1],
          payload_fingerprint: values[2],
          deleted_at: null,
        });
        return Promise.resolve([{ id: values[0] }]);
      }
      if (text.includes("select id from motorcycles"))
        return Promise.resolve(
          values[0] === bikeId && values[1] === ownerId ? [{ id: bikeId }] : [],
        );
      if (text.includes("select *, date::text as date from fuel_records"))
        return Promise.resolve(
          rows.has(String(values[0])) ? [rows.get(String(values[0]))] : [],
        );
      if (text.includes("insert into fuel_records")) {
        const payload = values[0] as Record<string, unknown>;
        if (race) {
          rows.set(String(payload.id), structuredClone(payload));
          race = false;
        }
        if (rows.has(String(payload.id))) return Promise.resolve([]);
        rows.set(String(payload.id), structuredClone(payload));
        inserts++;
        return Promise.resolve([{ id: payload.id }]);
      }
      if (text.includes("insert into fuel_preferences")) {
        preferences++;
        return Promise.resolve([]);
      }
      throw new Error(`Unexpected SQL: ${text}`);
    },
    {
      begin: async (callback: (db: unknown) => Promise<boolean>) =>
        callback(sql),
    },
  );
  return { sql, rows, receipts, counts: () => ({ inserts, preferences }) };
}

function form(overrides: Record<string, string> = {}) {
  const result = new FormData();
  for (const [key, value] of Object.entries({
    offline_submission_id: id,
    offline_owner_id: ownerId,
    motorcycle_id: bikeId,
    date: "2026-10-23",
    odometer_km: "1000",
    liters: "10",
    total_price: "60.00",
    price_per_liter: "6.000",
    tank_full: "true",
    ...overrides,
  }))
    result.set(key, value);
  return result;
}
function submit(
  db: ReturnType<typeof database>,
  body = form(),
  sessionOwner = ownerId,
) {
  return actions.createRecord({
    request: new Request("https://app.example/fuel?/createRecord", {
      method: "POST",
      body,
    }),
    locals: { user: { id: sessionOwner }, db: db.sql, locale: "en" },
    platform: undefined,
  } as unknown as RequestEvent);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("canonical offline fuel identity", () => {
  it("hashes sorted canonical fields without retaining plaintext and changes the digest when intent changes", async () => {
    const payload = {
      id,
      owner_id: ownerId,
      liters: 10.25,
      total_price_cents: 6000,
      notes: "Private station note",
    };
    const fingerprint = await offlineFuelFingerprint(payload);
    expect(fingerprint).toMatch(/^[0-9a-f]{64}$/);
    expect(fingerprint).not.toContain("Private");
    expect(
      await offlineFuelFingerprint({
        notes: payload.notes,
        total_price_cents: 6000,
        liters: 10.25,
        owner_id: ownerId.toUpperCase(),
        id: id.toUpperCase(),
      }),
    ).toBe(fingerprint);
    expect(
      await offlineFuelFingerprint({ ...payload, total_price_cents: 6001 }),
    ).not.toBe(fingerprint);
    expect(
      await offlineFuelFingerprint({ ...payload, notes: "Different intent" }),
    ).not.toBe(fingerprint);
  });
  it("accepts a stable UUID only and compares owner, nullable, decimal and boolean values", () => {
    expect(offlineFuelId(id.toUpperCase())).toBe(id);
    expect(offlineFuelId("not-a-uuid")).toBeNull();
    const payload = {
      id,
      owner_id: ownerId,
      date: "2026-10-23",
      liters: 10.25,
      receipt_file_key: null,
      tank_full: true,
    };
    expect(
      matchesFuelReplay(
        { ...payload, liters: "10.250", created_at: "server time" },
        payload,
      ),
    ).toBe(true);
    expect(
      matchesFuelReplay(
        { ...payload, liters: "10.235" },
        { ...payload, liters: 10.2346 },
      ),
    ).toBe(true);
    for (const patch of [
      { owner_id: "someone-else" },
      { liters: 10.24 },
      { receipt_file_key: "new-receipt" },
      { tank_full: false },
      { date: "2026-10-22" },
    ]) {
      expect(matchesFuelReplay({ ...payload, ...patch }, payload)).toBe(false);
    }
  });

  it("acknowledges a response-lost retry once without repeating preferences or odometer work", async () => {
    const db = database();
    const expected = { ok: true, offlineSubmissionId: id };
    expect(await submit(db)).toEqual(expected);
    expect(
      await submit(db, form({ total_price: "60,00", liters: "10.0" })),
    ).toEqual(expected);
    expect(db.rows.size).toBe(1);
    expect(db.counts()).toEqual({ inserts: 1, preferences: 1 });
    expect(effects.odometer).toHaveBeenCalledTimes(1);
    expect(effects.quota).not.toHaveBeenCalled();
  });

  it("acknowledges a concurrent identical insert without repeating side effects", async () => {
    const db = database(true);
    expect(await submit(db)).toEqual({ ok: true, offlineSubmissionId: id });
    expect(db.rows.size).toBe(1);
    expect(db.counts().preferences).toBe(0);
    expect(effects.odometer).not.toHaveBeenCalled();
  });

  it("acknowledges a committed and subsequently deleted record without resurrecting it", async () => {
    const db = database();
    await submit(db);
    db.rows.delete(id);
    db.receipts.get(id)!.deleted_at = "2026-10-23T12:00:00Z";
    expect(await submit(db)).toEqual({ ok: true, offlineSubmissionId: id });
    expect(db.rows.size).toBe(0);
    expect(db.counts()).toEqual({ inserts: 1, preferences: 1 });
    expect(effects.odometer).toHaveBeenCalledTimes(1);
  });

  it("blocks an unprovable legacy tombstone without recreating the record", async () => {
    const db = database();
    db.receipts.set(id, {
      owner_id: ownerId,
      payload_fingerprint: null,
      deleted_at: "2026-10-23T12:00:00Z",
    });
    expect(await submit(db)).toMatchObject({ status: 409 });
    expect(db.rows.size).toBe(0);
    expect(db.counts()).toEqual({ inserts: 0, preferences: 0 });
    expect(effects.odometer).not.toHaveBeenCalled();
  });

  it("returns the same generic conflict for another owner or a changed canonical payload without overwrite", async () => {
    const db = database();
    await submit(db);
    const original = structuredClone(db.rows.get(id));
    const changed = await submit(db, form({ total_price: "61" }));
    const foreign = await submit(
      db,
      form({ offline_owner_id: "other" }),
      "other",
    );
    expect(changed).toMatchObject({
      status: 409,
      data: {
        message:
          "Could not confirm this offline submission. Refresh the page and review the record.",
      },
    });
    expect(foreign).toEqual(changed);
    expect(db.rows.get(id)).toEqual(original);
    expect(db.counts()).toEqual({ inserts: 1, preferences: 1 });
  });

  it("rejects account changes, invalid identifiers and offline files before any upload or insert", async () => {
    const db = database();
    expect(await submit(db, form(), "other")).toMatchObject({ status: 409 });
    expect(
      await submit(db, form({ offline_submission_id: "invalid" })),
    ).toMatchObject({ status: 409 });
    const receipt = form();
    receipt.set(
      "receipt_file",
      new File(["photo"], "receipt.jpg", { type: "image/jpeg" }),
    );
    expect(await submit(db, receipt)).toMatchObject({ status: 400 });
    expect(db.rows.size).toBe(0);
    expect(effects.upload).not.toHaveBeenCalled();
    expect(effects.quota).not.toHaveBeenCalled();
  });
});
