import type { Sql } from "postgres";
import { syncPlanReminder } from "$server/domain/record-sync";

export type MotorcycleTemplate = {
  id: string;
  brand: string;
  model: string;
  year_from: number;
  year_to: number | null;
  variant: string;
  generation: string;
};

export type MotorcycleCatalogPreview = MotorcycleTemplate & {
  manual_url: string;
  document_version: string;
  page_reference: string;
  last_verified_date: string;
  coverage_notes: string;
  maintenance_count: number;
  maintenance_items?: Array<{
    maintenance_type: string;
    interval_km: number | null;
  }>;
};

export type InitialHistoryStatus = "confirmed_done" | "not_done" | "unknown";

export function initialHistoryStatus(
  value: string | null | undefined,
): InitialHistoryStatus {
  if (value === "confirmed_done" || value === "not_done") return value;
  return "unknown";
}

export function dueStateForPlan({
  historyStatus,
  lastDoneKm,
  intervalKm,
  currentKm,
}: {
  historyStatus: InitialHistoryStatus;
  lastDoneKm: number | null;
  intervalKm: number | null;
  currentKm: number;
}) {
  if (historyStatus === "not_done")
    return { urgency: "overdue" as const, dueKm: null };
  if (historyStatus === "unknown" || lastDoneKm === null)
    return { urgency: "due_now" as const, dueKm: null };
  const dueKm = intervalKm === null ? null : lastDoneKm + intervalKm;
  if (dueKm !== null && currentKm >= dueKm)
    return { urgency: "overdue" as const, dueKm };
  return { urgency: "scheduled" as const, dueKm };
}

export async function getTemplateForYear(
  db: Sql,
  templateId: string,
  year: number,
) {
  const [template] = await db<MotorcycleTemplate[]>`
    select id, brand, model, year_from, year_to, variant, generation
    from motorcycle_templates
    where id = ${templateId}
      and is_exact_schedule = true
      and ${year} >= year_from
      and (${year} <= year_to or year_to is null)
  `;
  return template ?? null;
}

export async function applyMotorcycleTemplate(
  db: Sql,
  ownerId: string,
  motorcycleId: string,
  templateId: string,
  currentOdometerKm: number,
  initialHistory: Record<string, InitialHistoryStatus> = {},
) {
  const [specs] = await db<Array<Record<string, string | number | null>>>`
    select * from motorcycle_template_specs where template_id = ${templateId}
  `;
  if (specs) {
    await db`
      insert into motorcycle_specs ${db({
        motorcycle_id: motorcycleId,
        fuel_tank_capacity_l: specs.fuel_tank_capacity_l,
        fuel_type_recommendation: specs.fuel_type_recommendation,
        fuel_octane_min: specs.fuel_octane_min,
        oil_capacity_l: specs.oil_capacity_l,
        tire_size_front: specs.tire_size_front,
        tire_size_rear: specs.tire_size_rear,
        tire_speed_rating: specs.tire_speed_rating,
        battery_spec: specs.battery_spec,
        chain_size: specs.chain_size,
        recommended_tire_pressure_front: specs.recommended_tire_pressure_front,
        recommended_tire_pressure_rear: specs.recommended_tire_pressure_rear,
        oil_type_recommendation: specs.oil_type_recommendation,
        oil_viscosity_recommendation: specs.oil_viscosity_recommendation,
        manual_reference: specs.manual_url,
        consumption_avg_km_l: specs.consumption_avg_km_l,
      })}
      on conflict (motorcycle_id) do update set
        fuel_tank_capacity_l = excluded.fuel_tank_capacity_l,
        fuel_type_recommendation = excluded.fuel_type_recommendation,
        fuel_octane_min = excluded.fuel_octane_min,
        oil_capacity_l = excluded.oil_capacity_l,
        tire_size_front = excluded.tire_size_front,
        tire_size_rear = excluded.tire_size_rear,
        tire_speed_rating = excluded.tire_speed_rating,
        battery_spec = excluded.battery_spec,
        chain_size = excluded.chain_size,
        recommended_tire_pressure_front = excluded.recommended_tire_pressure_front,
        recommended_tire_pressure_rear = excluded.recommended_tire_pressure_rear,
        oil_type_recommendation = excluded.oil_type_recommendation,
        oil_viscosity_recommendation = excluded.oil_viscosity_recommendation,
        manual_reference = excluded.manual_reference,
        consumption_avg_km_l = excluded.consumption_avg_km_l,
        updated_at = now()
    `;
  }

  const items = await db<
    Array<{
      maintenance_type: string;
      interval_km: number | null;
      interval_days: number | null;
      notes: string;
      manual_source_id: string | null;
      estimated_cost_cents: number;
    }>
  >`
    select maintenance_type, interval_km, interval_days, notes,
      manual_source_id, estimated_cost_cents
    from motorcycle_template_maintenance_items
    where template_id = ${templateId}
  `;
  for (const item of items) {
    const historyStatus = initialHistoryStatus(
      initialHistory[item.maintenance_type],
    );
    const confirmedNow = historyStatus === "confirmed_done";
    const [plan] = await db<Array<{ id: string }>>`
      insert into maintenance_plan_items ${db({
        owner_id: ownerId,
        motorcycle_id: motorcycleId,
        maintenance_type: item.maintenance_type,
        interval_km: item.interval_km,
        interval_days: item.interval_days,
        last_done_km: confirmedNow
          ? Math.max(0, Math.trunc(currentOdometerKm))
          : null,
        last_done_date: confirmedNow
          ? new Date().toISOString().slice(0, 10)
          : null,
        initial_history_status: historyStatus,
        manual_source_id: item.manual_source_id,
        estimated_cost_cents: item.estimated_cost_cents,
        notes: `${item.notes} Histórico inicial: ${historyStatus === "confirmed_done" ? "serviço confirmado no odômetro informado" : historyStatus === "not_done" ? "serviço informado como não realizado" : "histórico não confirmado; inspeção necessária antes de assumir um marco"}.`,
      })}
      on conflict (motorcycle_id, maintenance_type, is_severe_duty_override)
      do nothing
      returning id
    `;
    if (plan) {
      // Reminder caps can prevent an automatic reminder on Free; the complete
      // plan is still saved and shown to the owner.
      await syncPlanReminder(db, ownerId, {
        id: plan.id,
        motorcycle_id: motorcycleId,
        maintenance_type: item.maintenance_type,
        interval_km: item.interval_km,
        interval_days: item.interval_days,
        reference_km: confirmedNow ? currentOdometerKm : null,
      });
    }
  }
}
