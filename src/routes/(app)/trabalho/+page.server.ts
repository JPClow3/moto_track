import { fail } from "@sveltejs/kit";
import { featureActions, loadFeature } from "$server/domain/crud";
import { calculateWorkProfitability } from "$server/domain/parity";

function messageFrom(err: unknown) {
  return err instanceof Error ? err.message : String(err);
}

type Row = Record<string, unknown>;

const base = featureActions("trabalho");
export const actions = {
  ...base,
  saveCosts: async ({ request, locals }) => {
    const f = await request.formData();
    const motorcycleId = String(f.get("motorcycle_id") ?? "");
    const ownerId = locals.user!.id;
    try {
      // `professional_cost_settings` is unique on `motorcycle_id` alone, so the
      // `where` on the update guards against overwriting another owner's row
      // (there's no RLS backstop to fall back on anymore).
      await locals.db`
        insert into professional_cost_settings ${locals.db({
          owner_id: ownerId,
          motorcycle_id: motorcycleId,
          maintenance_reserve_per_km_millicents: Math.round(
            Number(f.get("maintenance_reserve") ?? 0) * 100000,
          ),
          depreciation_per_km_millicents: Math.round(
            Number(f.get("depreciation") ?? 0) * 100000,
          ),
          fixed_daily_cost_cents: Math.round(
            Number(f.get("fixed_daily_cost") ?? 0) * 100,
          ),
        })}
        on conflict (motorcycle_id) do update set
          maintenance_reserve_per_km_millicents = excluded.maintenance_reserve_per_km_millicents,
          depreciation_per_km_millicents = excluded.depreciation_per_km_millicents,
          fixed_daily_cost_cents = excluded.fixed_daily_cost_cents
        where professional_cost_settings.owner_id = ${ownerId}
      `;
    } catch (err) {
      return fail(400, { message: messageFrom(err) });
    }
    return { ok: true };
  },
};

export async function load({ locals }) {
  const baseData = await loadFeature(locals.db, "trabalho", locals.user!);
  const settings = await locals.db<Row[]>`
    select * from professional_cost_settings
    where owner_id = ${locals.user!.id}
  `.catch(() => [] as Row[]);
  const byMoto = new Map(settings.map((s) => [String(s.motorcycle_id), s]));
  const summaries = baseData.rows.map((row) => {
    const s = byMoto.get(String(row.motorcycle_id));
    return {
      work_date: String(row.work_date ?? ""),
      profitability: calculateWorkProfitability({
        distanceKm:
          Number(row.odometer_end_km ?? 0) - Number(row.odometer_start_km ?? 0),
        grossIncomeCents: Number(row.gross_income_cents ?? 0),
        tipsCents: Number(row.tips_cents ?? 0),
        fuelSpentCents: Number(row.fuel_spent_cents ?? 0),
        fixedDailyCostCents: Number(s?.fixed_daily_cost_cents ?? 0),
        maintenanceReservePerKmMillicents: Number(
          s?.maintenance_reserve_per_km_millicents ?? 0,
        ),
        depreciationPerKmMillicents: Number(
          s?.depreciation_per_km_millicents ?? 0,
        ),
      }),
    };
  });
  return { ...baseData, settings, summaries };
}
