import { fail } from "@sveltejs/kit";
import { shareTokenHash } from "$server/domain/sale-report-share";
import { siteUrl } from "$server/env";
import { buildTimeline, type TimelineEvent } from "$server/domain/parity";

function messageFrom(err: unknown) {
  return err instanceof Error ? err.message : String(err);
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

export const actions = {
  createShare: async ({ request, locals, platform }) => {
    const form = await request.formData();
    const motorcycleId = String(form.get("motorcycle_id") ?? "");
    const days = Math.max(Number(form.get("days") ?? 14), 1);
    const [motorcycle] = await locals.db<Row[]>`
      select id from motorcycles
      where id = ${motorcycleId} and owner_id = ${locals.user!.id} and is_active = true
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
};

export async function load({ locals, url }) {
  const ownerId = locals.user!.id;
  // Every read here failed open on Supabase too (an errored query resolved to
  // `data: null`, treated as empty) — `.catch` keeps one failing source from
  // blanking the whole timeline.
  const [fuel, maintenance, tires, fees, work, motorcycles, shares] =
    await Promise.all([
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
        where owner_id = ${ownerId} and is_active = true
        order by name
      `.catch(() => [] as MotorcycleOption[]),
      locals.db<ShareRow[]>`
        select id, token_prefix, expires_at, revoked_at, access_count, motorcycle_id
        from sale_report_shares
        where owner_id = ${ownerId}
        order by created_at desc
      `.catch(() => [] as ShareRow[]),
    ]);
  const events: TimelineEvent[] = [
    ...fuel.map((row) => ({
      source: "fuel",
      date: String(row.date),
      label: String(row.station_name || "Abastecimento"),
      amountCents: Number(row.total_price_cents),
    })),
    ...maintenance.map((row) => ({
      source: "maintenance",
      date: String(row.date),
      label: String(row.maintenance_type),
      amountCents: Number(row.cost_cents),
    })),
    ...tires.map((row) => ({
      source: "tires",
      date: String(row.installed_at),
      label: String(row.brand_model),
      amountCents: Number(row.cost_cents),
    })),
    ...fees.map((row) => ({
      source: "expenses",
      date: String(row.due_date),
      label: String(row.fee_type),
      amountCents: Number(row.amount_cents),
    })),
    ...work.map((row) => ({
      source: "work",
      date: String(row.work_date),
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
    motorcycles,
    shares,
    timeline: timeline.slice(0, 100),
    filters: {
      source: url.searchParams.get("source") ?? "",
      start: url.searchParams.get("start") ?? "",
      end: url.searchParams.get("end") ?? "",
    },
  };
}
