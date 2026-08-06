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
  is_exact_schedule: boolean;
  is_catalog_visible: boolean;
};

export type MotorcycleCatalogPreview = MotorcycleTemplate & {
  model_id: string;
  model_display_name: string;
  model_variant: string;
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

/**
 * One selectable model in the picker. `years` is the union across every
 * template hanging off the model, so "CG 160 Start" appears once with 2019 and
 * 2018 in its year dropdown instead of twice with the year in the label.
 */
export type CatalogModel = {
  id: string;
  brand: string;
  displayName: string;
  variant: string;
  hasExactSchedule: boolean;
  years: number[];
  templatesByYear: Record<string, MotorcycleCatalogPreview>;
};

export function catalogYears(
  template: Pick<MotorcycleTemplate, "year_from" | "year_to">,
  currentYear = new Date().getFullYear(),
) {
  const lastYear = Math.min(template.year_to ?? currentYear, currentYear);
  if (lastYear < template.year_from) return [];
  return Array.from(
    { length: lastYear - template.year_from + 1 },
    (_, index) => lastYear - index,
  );
}

export function listVisibleMotorcycleCatalog(db: Sql) {
  return db<MotorcycleCatalogPreview[]>`
    select t.id, t.brand, t.model, t.year_from, t.year_to, t.variant,
      t.generation, t.is_exact_schedule, t.is_catalog_visible,
      mo.id as model_id, mo.display_name as model_display_name,
      mo.variant as model_variant,
      ms.official_url as manual_url, ms.document_version,
      ms.page_reference, ms.last_verified_date::text, ms.coverage_notes,
      case when t.is_exact_schedule then
        (select count(*)::int from motorcycle_template_maintenance_items mi where mi.template_id = t.id)
      else 0 end as maintenance_count
    from motorcycle_templates t
    join motorcycle_models mo on mo.id = t.model_id
    join motorcycle_manual_sources ms on ms.template_id = t.id
    where t.is_catalog_visible = true and mo.is_visible = true
    order by mo.brand, mo.display_name, t.year_from desc
  `;
}

/**
 * Two templates can cover the same year for one model: a sales-line row
 * spanning 2006-2026 and an exact single-year row. An exact schedule was
 * transcribed from that year's manual, so it always wins; a wider range only
 * fills the years no exact row covers.
 */
function preferredTemplate(
  a: MotorcycleCatalogPreview,
  b: MotorcycleCatalogPreview,
) {
  if (a.is_exact_schedule !== b.is_exact_schedule)
    return a.is_exact_schedule ? a : b;
  const spanOf = (template: MotorcycleCatalogPreview) =>
    (template.year_to ?? template.year_from) - template.year_from;
  if (spanOf(a) !== spanOf(b)) return spanOf(a) < spanOf(b) ? a : b;
  return a.year_from >= b.year_from ? a : b;
}

/**
 * Collapses catalogue rows into the models the picker offers. Labels never
 * carry a year — the form asks for one separately, and repeating it in the
 * model name is what made three entries look like the same motorcycle.
 */
export function groupCatalogModels(
  templates: MotorcycleCatalogPreview[],
  currentYear = new Date().getFullYear(),
): CatalogModel[] {
  const models = new Map<string, CatalogModel>();
  for (const template of templates) {
    const existing = models.get(template.model_id);
    const model: CatalogModel = existing ?? {
      id: template.model_id,
      brand: template.brand,
      displayName: template.model_display_name,
      variant: template.model_variant,
      hasExactSchedule: false,
      years: [],
      templatesByYear: {},
    };
    if (!existing) models.set(template.model_id, model);
    model.hasExactSchedule ||= template.is_exact_schedule;
    for (const year of catalogYears(template, currentYear)) {
      const current = model.templatesByYear[year];
      model.templatesByYear[year] = current
        ? preferredTemplate(current, template)
        : template;
    }
  }
  for (const model of models.values()) {
    model.years = Object.keys(model.templatesByYear)
      .map(Number)
      .sort((a, b) => b - a);
  }
  return [...models.values()].sort(
    (a, b) =>
      a.brand.localeCompare(b.brand) ||
      Number(b.hasExactSchedule) - Number(a.hasExactSchedule) ||
      a.displayName.localeCompare(b.displayName),
  );
}

/**
 * The catalogue as both pickers consume it: models to choose from, each
 * carrying the per-year templates and — for exact schedules — the maintenance
 * items the initial-history step asks about.
 */
export async function loadCatalogModels(db: Sql) {
  const templates = await listVisibleMotorcycleCatalog(db);
  const exactIds = templates
    .filter((template) => template.is_exact_schedule)
    .map((template) => template.id);
  const items = exactIds.length
    ? await db<
        Array<{
          template_id: string;
          maintenance_type: string;
          interval_km: number | null;
        }>
      >`
        select template_id, maintenance_type, interval_km
        from motorcycle_template_maintenance_items
        where template_id in ${db(exactIds)}
        order by maintenance_type
      `
    : [];
  return groupCatalogModels(
    templates.map((template) => ({
      ...template,
      maintenance_items: items.filter(
        (item) => item.template_id === template.id,
      ),
    })),
  );
}

/**
 * Server-side counterpart of the picker's selection. It groups the same rows
 * through the same helper rather than re-implementing the tie-break in SQL, so
 * the template the rider saw described is the template that gets applied.
 */
export async function resolveCatalogSelection(
  db: Sql,
  modelId: string,
  year: number,
) {
  const models = groupCatalogModels(await listVisibleMotorcycleCatalog(db));
  const model = models.find((candidate) => candidate.id === modelId);
  if (!model) return null;
  return model.templatesByYear[year] ?? null;
}

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
    select mi.maintenance_type, mi.interval_km, mi.interval_days, mi.notes,
      mi.manual_source_id, mi.estimated_cost_cents
    from motorcycle_template_maintenance_items mi
    join motorcycle_templates t on t.id = mi.template_id
    where mi.template_id = ${templateId}
      and t.is_exact_schedule = true
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
