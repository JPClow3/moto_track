import type { Sql } from "postgres";

export type OdometerSource = {
  odometer_km?: number | null;
  installed_odometer_km?: number | null;
  odometer_end_km?: number | null;
};

export function recomputeOdometer({
  overrideKm,
  fuel,
  maintenance,
  tires,
  work = [],
}: {
  overrideKm?: number | null;
  fuel: OdometerSource[];
  maintenance: OdometerSource[];
  tires: OdometerSource[];
  work?: OdometerSource[];
}) {
  const values = [
    overrideKm ?? 0,
    ...fuel.map((row) => row.odometer_km ?? 0),
    ...maintenance.map((row) => row.odometer_km ?? 0),
    ...tires.map((row) => row.installed_odometer_km ?? 0),
    ...work.map((row) => row.odometer_end_km ?? 0),
  ];
  return Math.max(0, ...values.map((value) => Number(value) || 0));
}

export function validateOdometer(candidate: number, current: number) {
  if (!Number.isFinite(candidate) || candidate < 0)
    return "O odômetro deve ser positivo.";
  if (current > 0 && candidate < current)
    return "O odômetro não pode retroceder.";
  return null;
}

// The Supabase version never checked `{ error }` on any of these calls — a
// failed read just fell back to `data ?? []` (or, for the motorcycle lookup,
// `!data` short-circuited the whole sync). Reproduce that exact swallow with
// try/catch per query instead of letting postgres.js's thrown errors bubble,
// since this is a best-effort cache refresh, not a user-facing action.
async function rowsOrEmpty<T extends object>(
  query: Promise<T[]>,
): Promise<T[]> {
  try {
    return await query;
  } catch {
    return [];
  }
}

export async function syncMotorcycleOdometer(
  db: Sql,
  ownerId: string,
  motorcycleId: string,
) {
  let motorcycle: { odometer_override_km: number | null } | undefined;
  try {
    [motorcycle] = await db<{ odometer_override_km: number | null }[]>`
      select odometer_override_km from motorcycles
      where id = ${motorcycleId} and owner_id = ${ownerId}
    `;
  } catch {
    return;
  }
  if (!motorcycle) return;

  const [fuel, maintenance, tires, work] = await Promise.all([
    rowsOrEmpty(
      db<{ odometer_km: number | null }[]>`
        select odometer_km from fuel_records
        where motorcycle_id = ${motorcycleId} and owner_id = ${ownerId}
      `,
    ),
    rowsOrEmpty(
      db<{ odometer_km: number | null }[]>`
        select odometer_km from maintenance_records
        where motorcycle_id = ${motorcycleId} and owner_id = ${ownerId}
      `,
    ),
    rowsOrEmpty(
      db<{ installed_odometer_km: number | null }[]>`
        select installed_odometer_km from tire_records
        where motorcycle_id = ${motorcycleId} and owner_id = ${ownerId}
      `,
    ),
    rowsOrEmpty(
      db<{ odometer_end_km: number | null }[]>`
        select odometer_end_km from work_sessions
        where motorcycle_id = ${motorcycleId} and owner_id = ${ownerId}
      `,
    ),
  ]);

  const currentOdometerKm = recomputeOdometer({
    overrideKm: motorcycle.odometer_override_km,
    fuel,
    maintenance,
    tires,
    work,
  });

  try {
    await db`
      update motorcycles
      set current_odometer_km = ${currentOdometerKm},
        current_odometer_updated_at = ${new Date().toISOString()}
      where id = ${motorcycleId} and owner_id = ${ownerId}
    `;
  } catch {
    // Match the Supabase version, which never checked this update's error.
  }
}
