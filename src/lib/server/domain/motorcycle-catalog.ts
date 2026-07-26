import type { Sql } from "postgres";
import { syncPlanReminder } from "$server/domain/record-sync";

export type MotorcycleTemplate = {
  id: string;
  brand: string;
  model: string;
  year_from: number;
  year_to: number | null;
  variant: string;
};

export type MotorcycleCatalogPreview = MotorcycleTemplate & {
  manual_url: string;
  maintenance_count: number;
};

export function manualScheduleAnchor(
  currentOdometerKm: number,
  intervalKm: number,
) {
  const currentKm = Math.max(0, Math.trunc(currentOdometerKm));
  const interval = Math.max(1, Math.trunc(intervalKm));
  // A model's table is a sequence of odometer milestones, not a promise that
  // a second-hand motorcycle was serviced at the last one.  Pick the first
  // milestone at or after the entered odometer, so 50,000 km with a 6,000 km
  // interval points to 54,000 km rather than blindly adding 6,000 to 50,000.
  const nextDueKm = Math.max(
    interval,
    Math.ceil(currentKm / interval) * interval,
  );
  return { referenceKm: nextDueKm - interval, nextDueKm };
}

export async function getTemplateForYear(
  db: Sql,
  templateId: string,
  year: number,
) {
  const [template] = await db<MotorcycleTemplate[]>`
    select id, brand, model, year_from, year_to, variant
    from motorcycle_templates
    where id = ${templateId}
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
    }>
  >`
    select maintenance_type, interval_km, interval_days, notes
    from motorcycle_template_maintenance_items
    where template_id = ${templateId}
  `;
  for (const item of items) {
    const anchor = item.interval_km
      ? manualScheduleAnchor(currentOdometerKm, item.interval_km)
      : null;
    const [plan] = await db<Array<{ id: string }>>`
      insert into maintenance_plan_items ${db({
        owner_id: ownerId,
        motorcycle_id: motorcycleId,
        maintenance_type: item.maintenance_type,
        interval_km: item.interval_km,
        interval_days: item.interval_days,
        last_done_km: anchor?.referenceKm ?? null,
        notes: anchor
          ? `${item.notes} Marco do manual para odômetro inicial de ${Math.max(0, Math.trunc(currentOdometerKm)).toLocaleString("pt-BR")} km; próxima recomendação em ${anchor.nextDueKm.toLocaleString("pt-BR")} km. Confirme o histórico de serviços.`
          : item.notes,
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
        reference_km: anchor?.referenceKm ?? null,
      });
    }
  }
}
