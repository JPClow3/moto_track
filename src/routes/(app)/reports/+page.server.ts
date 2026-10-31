import { localizedActions } from "$server/domain/localized-actions";
import { exportMessages } from "$lib/i18n/exports";
import { fail, isRedirect, redirect } from "@sveltejs/kit";
import { shareTokenHash } from "$server/domain/sale-report-share";
import { siteUrl } from "$server/env";
import { buildTimeline, type TimelineEvent } from "$server/domain/parity";
import { loadOwnershipCosts } from "$server/domain/ownership-report";
import { validDate } from "$server/domain/maintenance-forecast";
import { parseLocalizedNumber } from "$server/domain/fuel";
import { isoDateValue } from "$server/domain/date-value";
import { lockObjectOwner } from "$server/db/owner-lock";
import type { Sql } from "postgres";
import {
  comparableBenchmarkMetrics,
  hasComparableBenchmarkMetric,
  modelBenchmarkKey,
} from "$server/domain/model-benchmark";
import type { FuelRecord } from "$server/domain/fuel";
import { _loadGarage } from "../dashboard/+page.server";

import { latestCalendarDay } from "$lib/utils/calendar-day";
function messageFrom(err: unknown) {
  return err instanceof Error ? err.message : String(err);
}

function formValue(form: FormData, key: string) {
  return String(form.get(key) ?? "").trim();
}

type Row = Record<string, unknown>;

type MotorcycleOption = {
  id: string;
  name: string;
  brand: string;
  model: string;
  year: number;
};

type ShareRow = {
  id: string;
  token_prefix: string;
  expires_at: string;
  revoked_at: string | null;
  access_count: number;
  motorcycle_id: string;
};

export const actions = localizedActions({
  contributeBenchmark: async ({ request, locals }) => {
    const ownerId = locals.user?.id;
    if (!ownerId)
      return fail(401, {
        benchmark: true,
        message: "Entre para compartilhar.",
      });

    const form = await request.formData();
    const motorcycleId = formValue(form, "motorcycle_id");
    const consent = formValue(form, "consent");
    if (!motorcycleId) {
      return fail(400, {
        benchmark: true,
        message: "Escolha uma moto para comparar.",
      });
    }
    if (!consent || !["on", "true", "1"].includes(consent)) {
      return fail(400, {
        benchmark: true,
        message: "Confirme o compartilhamento anônimo para continuar.",
      });
    }

    let motorcycle: Row | undefined;
    let fuelRows: Row[] = [];
    let maintenanceRows: Row[] = [];
    try {
      [motorcycle] = await locals.db<Row[]>`
        select id, brand, model, year
        from motorcycles
        where id = ${motorcycleId} and owner_id = ${ownerId}
        limit 1
      `;
      if (!motorcycle) {
        return fail(400, {
          benchmark: true,
          message: "Motocicleta não encontrada.",
        });
      }
      [fuelRows, maintenanceRows] = await Promise.all([
        locals.db<Row[]>`
          select date, odometer_km, liters, tank_full
          from fuel_records
          where owner_id = ${ownerId} and motorcycle_id = ${motorcycleId}
        `,
        locals.db<Row[]>`
          select date, odometer_km, cost_cents
          from maintenance_records
          where owner_id = ${ownerId} and motorcycle_id = ${motorcycleId}
        `,
      ]);
    } catch (err) {
      return fail(400, { benchmark: true, message: messageFrom(err) });
    }

    const benchmarkKey = modelBenchmarkKey(
      String(motorcycle.brand ?? ""),
      String(motorcycle.model ?? ""),
      Number(motorcycle.year),
    );
    if (!benchmarkKey) {
      return fail(400, {
        benchmark: true,
        message:
          "Complete marca, modelo e ano da moto antes de participar do comparativo.",
      });
    }

    const metrics = comparableBenchmarkMetrics(
      fuelRows as unknown as FuelRecord[],
      maintenanceRows,
    );
    if (!hasComparableBenchmarkMetric(metrics)) {
      return fail(400, {
        benchmark: true,
        message:
          "Ainda não há histórico comparável. Registre dois tanques cheios ou uma manutenção com odômetros consistentes.",
      });
    }

    try {
      await locals.db.begin(async (tx) => {
        // One guard row per account/model. Reusing its opaque contribution id
        // makes a later explicit submission an upsert, while the benchmark
        // table never receives owner_id.
        const [guard] = await tx<Array<{ contribution_id: string }>>`
          insert into model_benchmark_submission_guards (owner_id, model_key)
          values (${ownerId}, ${benchmarkKey})
          on conflict (owner_id, model_key)
          do update set updated_at = now()
          returning contribution_id
        `;
        if (!guard?.contribution_id) {
          throw new Error("Não foi possível reservar a contribuição anônima.");
        }

        await tx`
          insert into anonymous_model_benchmark_contributions
            (id, model_key, consumption_km_l, maintenance_cents)
          values (
            ${guard.contribution_id},
            ${benchmarkKey},
            ${metrics.consumptionKmL},
            ${metrics.maintenanceCentsPer1000Km}
          )
          on conflict (id)
          do update set
            model_key = excluded.model_key,
            consumption_km_l = excluded.consumption_km_l,
            maintenance_cents = excluded.maintenance_cents,
            updated_at = now()
        `;
      });
    } catch (err) {
      return fail(400, { benchmark: true, message: messageFrom(err) });
    }

    throw redirect(
      303,
      `/reports?benchmark=${encodeURIComponent(motorcycleId)}#benchmark`,
    );
  },
  saveOwnershipBasis: async ({ request, locals }) => {
    const form = await request.formData();
    const id = String(form.get("motorcycle_id") ?? "");
    const date = validDate(form.get("purchase_date"));
    const mileage = parseLocalizedNumber(
      String(form.get("purchase_odometer_km") ?? ""),
    );
    const price = parseLocalizedNumber(
      String(form.get("purchase_price") ?? ""),
    );
    if (
      !date ||
      date > latestCalendarDay() ||
      mileage === null ||
      !Number.isInteger(mileage) ||
      mileage < 0 ||
      mileage > 2147483647 ||
      price === null ||
      price < 0 ||
      Math.round(price * 100) > 2147483647
    ) {
      return fail(400, {
        message: "Informe data, valor e odômetro válidos para a aquisição.",
      });
    }
    try {
      const updated = await locals.db.begin(async (tx) => {
        await lockObjectOwner(tx as unknown as Sql, locals.user!.id);
        const [bike] = await tx<Array<{ current_odometer_km: number }>>`
          select current_odometer_km from motorcycles
          where id = ${id} and owner_id = ${locals.user!.id} and deleted_at is null for update
        `;
        if (!bike || mileage > Number(bike.current_odometer_km)) return false;
        await tx`update motorcycles set purchase_date = ${date}, purchase_odometer_km = ${mileage},
            purchase_price_cents = ${Math.round(price * 100)}, purchase_currency = 'BRL', updated_at = now()
          where id = ${id} and owner_id = ${locals.user!.id}`;
        return true;
      });
      return updated
        ? { ok: true }
        : fail(400, {
            message:
              "Moto não encontrada ou odômetro da compra maior que o atual.",
          });
    } catch (err) {
      return fail(400, { message: messageFrom(err) });
    }
  },
  createShare: async ({ request, locals, platform }) => {
    const form = await request.formData();
    const motorcycleId = String(form.get("motorcycle_id") ?? "");
    const requestedDays = Math.round(Number(form.get("days") ?? 14));
    const days = Number.isFinite(requestedDays)
      ? Math.min(Math.max(requestedDays, 1), 90)
      : 14;
    const [motorcycle] = await locals.db<Row[]>`
      select id from motorcycles
      where id = ${motorcycleId} and owner_id = ${locals.user!.id} and is_active = true and deleted_at is null
    `;
    if (!motorcycle) return fail(404, { message: "Moto não encontrada." });
    const token = `${crypto.randomUUID().replaceAll("-", "")}${crypto.randomUUID().replaceAll("-", "")}`;
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + days);
    try {
      await locals.db`
        insert into sale_report_shares ${locals.db({
          owner_id: locals.user!.id,
          motorcycle_id: motorcycleId,
          token_prefix: token.slice(0, 12),
          token_hash: await shareTokenHash(token),
          expires_at: expiresAt.toISOString(),
        })}
      `;
    } catch (err) {
      return fail(400, { message: messageFrom(err) });
    }
    return { publicUrl: `${siteUrl(platform)}/reports/sale/public/${token}` };
  },
  revokeShare: async ({ request, locals }) => {
    const form = await request.formData();
    try {
      await locals.db`
        update sale_report_shares
        set revoked_at = ${new Date().toISOString()}
        where id = ${String(form.get("id") ?? "")} and owner_id = ${locals.user!.id}
      `;
    } catch (err) {
      return fail(400, { message: messageFrom(err) });
    }
    return { ok: true };
  },
});

/**
 * Consumption, spending, activity and the opt-in model comparison moved here
 * from the bike home, which now only answers "does my bike need me?".
 */
async function loadInsights(event: Parameters<typeof _loadGarage>[0]) {
  try {
    const garage = await _loadGarage(event, { includeBenchmark: true });
    return {
      consumption: garage.consumption,
      spend: garage.spend,
      costs: garage.costs,
      activity: garage.activity,
      recentActivity: garage.recentActivity,
      benchmark: garage.benchmark,
    };
  } catch (err) {
    // No bike yet: the garage loader sends the rider to onboarding; here the
    // page just shows its own empty state.
    if (isRedirect(err)) return null;
    throw err;
  }
}

export async function load({ locals, url, parent }) {
  const ownerId = locals.user!.id;
  const insightsPromise = loadInsights({ locals, url, parent });
  // Every read here failed open on Supabase too (an errored query resolved to
  // `data: null`, treated as empty) — `.catch` keeps one failing source from
  // blanking the whole timeline.
  const [
    fuel,
    maintenance,
    tires,
    fees,
    work,
    motorcycles,
    shares,
    ownershipCosts,
  ] = await Promise.all([
    locals.db<Row[]>`
        select date, total_price_cents, station_name from fuel_records
        where owner_id = ${ownerId}
      `.catch(() => [] as Row[]),
    locals.db<Row[]>`
        select date, cost_cents, maintenance_type from maintenance_records
        where owner_id = ${ownerId}
      `.catch(() => [] as Row[]),
    locals.db<Row[]>`
        select installed_at, cost_cents, brand_model from tire_records
        where owner_id = ${ownerId}
      `.catch(() => [] as Row[]),
    locals.db<Row[]>`
        select due_date, amount_cents, fee_type from annual_fees
        where owner_id = ${ownerId}
      `.catch(() => [] as Row[]),
    locals.db<Row[]>`
        select work_date, gross_income_cents, platform_source from work_sessions
        where owner_id = ${ownerId}
      `.catch(() => [] as Row[]),
    locals.db<MotorcycleOption[]>`
        select id, name, brand, model, year from motorcycles
        where owner_id = ${ownerId} and is_active = true and deleted_at is null
        order by name
      `.catch(() => [] as MotorcycleOption[]),
    locals.db<ShareRow[]>`
        select id, token_prefix, expires_at, revoked_at, access_count, motorcycle_id
        from sale_report_shares
        where owner_id = ${ownerId}
        order by created_at desc
      `.catch(() => [] as ShareRow[]),
    loadOwnershipCosts(locals.db, ownerId),
  ]);
  const events: TimelineEvent[] = [
    ...fuel.map((row) => ({
      source: "fuel",
      date: isoDateValue(row.date),
      label: String(row.station_name || exportMessages(locals.locale).fuel),
      amountCents: Number(row.total_price_cents),
    })),
    ...maintenance.map((row) => ({
      source: "maintenance",
      date: isoDateValue(row.date),
      label: String(row.maintenance_type),
      amountCents: Number(row.cost_cents),
    })),
    ...tires.map((row) => ({
      source: "tires",
      date: isoDateValue(row.installed_at),
      label: String(row.brand_model),
      amountCents: Number(row.cost_cents),
    })),
    ...fees.map((row) => ({
      source: "expenses",
      date: isoDateValue(row.due_date),
      label: String(row.fee_type),
      amountCents: Number(row.amount_cents),
    })),
    ...work.map((row) => ({
      source: "work",
      date: isoDateValue(row.work_date),
      label: String(row.platform_source),
      amountCents: -Number(row.gross_income_cents),
    })),
  ];
  const timeline = buildTimeline(events, {
    source: url.searchParams.get("source") || undefined,
    start: url.searchParams.get("start") || undefined,
    end: url.searchParams.get("end") || undefined,
  });
  return {
    insights: await insightsPromise,
    motorcycles,
    ownershipCosts,
    shares,
    timeline: timeline.slice(0, 100),
    filters: {
      source: url.searchParams.get("source") ?? "",
      start: url.searchParams.get("start") ?? "",
      end: url.searchParams.get("end") ?? "",
    },
  };
}
