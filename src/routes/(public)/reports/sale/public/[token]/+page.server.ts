import { error } from "@sveltejs/kit";
import { createSupabaseAdminClient } from "$server/supabase/admin";
import { shareTokenHash } from "$server/domain/sale-report-share";
import type { PublicSaleReport } from "$types/sale-report";

/**
 * This route is unauthenticated and uses the admin client, so every column it
 * reads is a deliberate choice. Never `select("*")` here.
 *
 * Deliberately NOT exposed from `motorcycles`:
 *   owner_id             — the owner's identity
 *   purchase_price_cents — what the seller paid; a buyer must not see it
 *   license_plate        — identifies the vehicle
 *   observations         — the owner's private notes
 *   photo_key            — storage key
 * And from `sale_report_shares`: token_hash, owner_id.
 */
const MOTORCYCLE_COLUMNS =
  "name, brand, model, year, current_odometer_km, previous_owners, riding_profile, deleted_at";

const TIMELINE_LIMIT = 60;

type Row = Record<string, unknown>;

const sum = (rows: Row[] | null, key: string) =>
  (rows ?? []).reduce((total, row) => total + Number(row[key] ?? 0), 0);

export async function load({ params, platform }) {
  const supabase = createSupabaseAdminClient(platform);
  const tokenHash = await shareTokenHash(params.token);

  const { data: share } = await supabase
    .from("sale_report_shares")
    .select(
      `id, owner_id, motorcycle_id, expires_at, access_count, motorcycles(${MOTORCYCLE_COLUMNS})`,
    )
    .eq("token_hash", tokenHash)
    .is("revoked_at", null)
    .gte("expires_at", new Date().toISOString())
    .maybeSingle();

  if (!share) throw error(404, "Relatório não encontrado ou expirado.");

  const row = share as unknown as Row;
  const motorcycle = (
    Array.isArray(row.motorcycles) ? row.motorcycles[0] : row.motorcycles
  ) as Row | null;

  // A share can outlive the motorcycle it points at.
  if (!motorcycle || motorcycle.deleted_at) {
    throw error(404, "Relatório não encontrado ou expirado.");
  }

  // Scope every query to the shared motorcycle AND the share's owner, so a
  // stale or tampered motorcycle_id can never pull another owner's records.
  const ownerId = String(row.owner_id);
  const motorcycleId = String(row.motorcycle_id);
  const scoped = (table: string, columns: string) =>
    supabase
      .from(table)
      .select(columns)
      .eq("motorcycle_id", motorcycleId)
      .eq("owner_id", ownerId);

  const [fuel, maintenance, tires, fees, timeline] = await Promise.all([
    scoped("fuel_records", "total_price_cents"),
    scoped("maintenance_records", "cost_cents"),
    scoped("tire_records", "cost_cents"),
    scoped("annual_fees", "amount_cents"),
    scoped(
      "maintenance_records",
      "date, maintenance_type, odometer_km, description, cost_cents",
    )
      .order("date", { ascending: false })
      .limit(TIMELINE_LIMIT),
  ]);

  await supabase
    .from("sale_report_shares")
    .update({
      access_count: Number(row.access_count ?? 0) + 1,
      last_accessed_at: new Date().toISOString(),
    })
    .eq("id", String(row.id));

  const totals = {
    fuel: sum(fuel.data as Row[] | null, "total_price_cents"),
    maintenance: sum(maintenance.data as Row[] | null, "cost_cents"),
    tires: sum(tires.data as Row[] | null, "cost_cents"),
    fees: sum(fees.data as Row[] | null, "amount_cents"),
  };

  const report: PublicSaleReport = {
    motorcycle: {
      name: String(motorcycle.name ?? ""),
      brand: String(motorcycle.brand ?? ""),
      model: String(motorcycle.model ?? ""),
      year: Number(motorcycle.year ?? 0),
      odometerKm: Number(motorcycle.current_odometer_km ?? 0),
      previousOwners:
        motorcycle.previous_owners === null ||
        motorcycle.previous_owners === undefined
          ? null
          : Number(motorcycle.previous_owners),
      ridingProfile: String(motorcycle.riding_profile ?? "") || null,
    },
    totals: {
      ...totals,
      all: totals.fuel + totals.maintenance + totals.tires + totals.fees,
    },
    serviceCount: (maintenance.data ?? []).length,
    timeline: ((timeline.data ?? []) as unknown as Row[]).map((event) => ({
      date: String(event.date ?? ""),
      type: String(event.maintenance_type ?? "") || null,
      odometerKm:
        event.odometer_km === null || event.odometer_km === undefined
          ? null
          : Number(event.odometer_km),
      description: String(event.description ?? "") || null,
      costCents: Number(event.cost_cents ?? 0),
    })),
    expiresAt: String(row.expires_at ?? ""),
  };

  // Return only the mapped projection — anything on `report` is public.
  return { report };
}
