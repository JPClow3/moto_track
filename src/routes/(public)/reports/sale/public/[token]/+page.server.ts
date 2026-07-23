import { error } from "@sveltejs/kit";
import { shareTokenHash } from "$server/domain/sale-report-share";
import type { PublicSaleReport } from "$types/sale-report";

/**
 * This route is unauthenticated (bearer-token access via the share link), so
 * every column it reads is a deliberate choice. Never `select *` here.
 *
 * Deliberately NOT exposed from `motorcycles`:
 *   owner_id             — the owner's identity
 *   purchase_price_cents — what the seller paid; a buyer must not see it
 *   license_plate        — identifies the vehicle
 *   observations         — the owner's private notes
 *   photo_key            — storage key
 * And from `sale_report_shares`: token_hash, owner_id.
 */
const TIMELINE_LIMIT = 60;

type Row = Record<string, unknown>;

const sum = (rows: Row[], key: string) =>
  rows.reduce((total, row) => total + Number(row[key] ?? 0), 0);

export async function load({ params, locals }) {
  const tokenHash = await shareTokenHash(params.token);

  // The WHERE clause below is the *only* gate on this route — there is no
  // session and no RLS backstop. A row only comes back for a token whose hash
  // matches, that hasn't been revoked, and whose expiry hasn't passed.
  const [share] = await locals.db<Row[]>`
    select id, owner_id, motorcycle_id, expires_at, access_count
    from sale_report_shares
    where token_hash = ${tokenHash}
      and revoked_at is null
      and expires_at >= now()
  `;

  if (!share) throw error(404, "Relatório não encontrado ou expirado.");

  const ownerId = String(share.owner_id);
  const motorcycleId = String(share.motorcycle_id);

  // Every downstream query is scoped to *this share's* owner_id/motorcycle_id
  // (taken from the row we just validated above), never to a session user —
  // there isn't one. A stale or tampered motorcycle_id on the share can never
  // pull another owner's records because both columns are re-checked here.
  const [motorcycle, fuel, maintenance, tires, fees, timeline] =
    await Promise.all([
      locals.db<Row[]>`
        select name, brand, model, year, current_odometer_km, previous_owners,
               riding_profile, deleted_at
        from motorcycles
        where id = ${motorcycleId} and owner_id = ${ownerId}
      `,
      locals.db<Row[]>`
        select total_price_cents from fuel_records
        where motorcycle_id = ${motorcycleId} and owner_id = ${ownerId}
      `,
      locals.db<Row[]>`
        select cost_cents from maintenance_records
        where motorcycle_id = ${motorcycleId} and owner_id = ${ownerId}
      `,
      locals.db<Row[]>`
        select cost_cents from tire_records
        where motorcycle_id = ${motorcycleId} and owner_id = ${ownerId}
      `,
      locals.db<Row[]>`
        select amount_cents from annual_fees
        where motorcycle_id = ${motorcycleId} and owner_id = ${ownerId}
      `,
      locals.db<Row[]>`
        select date, maintenance_type, odometer_km, description, cost_cents
        from maintenance_records
        where motorcycle_id = ${motorcycleId} and owner_id = ${ownerId}
        order by date desc
        limit ${TIMELINE_LIMIT}
      `,
    ]);

  const motorcycleRow = motorcycle[0];
  // A share can outlive the motorcycle it points at.
  if (!motorcycleRow || motorcycleRow.deleted_at) {
    throw error(404, "Relatório não encontrado ou expirado.");
  }

  await locals.db`
    update sale_report_shares
    set access_count = ${Number(share.access_count ?? 0) + 1},
        last_accessed_at = ${new Date().toISOString()}
    where id = ${String(share.id)}
  `;

  const totals = {
    fuel: sum(fuel, "total_price_cents"),
    maintenance: sum(maintenance, "cost_cents"),
    tires: sum(tires, "cost_cents"),
    fees: sum(fees, "amount_cents"),
  };

  const report: PublicSaleReport = {
    motorcycle: {
      name: String(motorcycleRow.name ?? ""),
      brand: String(motorcycleRow.brand ?? ""),
      model: String(motorcycleRow.model ?? ""),
      year: Number(motorcycleRow.year ?? 0),
      odometerKm: Number(motorcycleRow.current_odometer_km ?? 0),
      previousOwners:
        motorcycleRow.previous_owners === null ||
        motorcycleRow.previous_owners === undefined
          ? null
          : Number(motorcycleRow.previous_owners),
      ridingProfile: String(motorcycleRow.riding_profile ?? "") || null,
    },
    totals: {
      ...totals,
      all: totals.fuel + totals.maintenance + totals.tires + totals.fees,
    },
    serviceCount: maintenance.length,
    timeline: timeline.map((event) => ({
      date: String(event.date ?? ""),
      type: String(event.maintenance_type ?? "") || null,
      odometerKm:
        event.odometer_km === null || event.odometer_km === undefined
          ? null
          : Number(event.odometer_km),
      description: String(event.description ?? "") || null,
      costCents: Number(event.cost_cents ?? 0),
    })),
    expiresAt: String(share.expires_at ?? ""),
  };

  // Return only the mapped projection — anything on `report` is public.
  return { report };
}
