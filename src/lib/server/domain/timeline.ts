import type { Sql } from "postgres";
import { isoDateValue } from "$server/domain/date-value";

/**
 * One reverse-chronological "what has been done to my bike" stream, merged
 * from the per-feature tables. The pure helpers below are what the /history
 * page and its unit tests share; `loadTimeline` is the owner-scoped reader.
 */

export const TIMELINE_KINDS = [
  "fuel",
  "maintenance",
  "tires",
  "expenses",
] as const;

export type TimelineKind = (typeof TIMELINE_KINDS)[number];
export type TimelineFilter = TimelineKind | "all";

/** Expenses come from two tables; the page labels them differently. */
export type TimelineSubkind = TimelineKind | "fee" | "insurance";

export type TimelineEntry = {
  id: string;
  kind: TimelineKind;
  subkind: TimelineSubkind;
  /** YYYY-MM-DD calendar day. */
  date: string;
  odometerKm: number | null;
  amountCents: number;
  currency: string;
  /** Rider-entered primary text (maintenance type, fee type, tire model). */
  label: string;
  /** Rider-entered secondary text (station, workshop, insurer). */
  detail: string;
  liters: number | null;
  position: string | null;
  motorcycleId: string | null;
  motorcycleName: string;
  href: string;
};

export type TimelineMonth = {
  /** YYYY-MM */
  key: string;
  entries: TimelineEntry[];
  /** Sum of the month's entries in the totals currency (BRL). */
  totalCents: number;
};

export const TIMELINE_HREF: Record<TimelineKind, string> = {
  fuel: "/fuel",
  maintenance: "/maintenance",
  tires: "/tires",
  expenses: "/expenses",
};

export const TIMELINE_TOTAL_CURRENCY = "BRL";
export const TIMELINE_WINDOW_MONTHS = 12;

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function parseTimelineFilter(value: unknown): TimelineFilter {
  const text = String(value ?? "");
  return (TIMELINE_KINDS as readonly string[]).includes(text)
    ? (text as TimelineKind)
    : "all";
}

/** A real calendar day in YYYY-MM-DD, or null. */
export function parseCalendarDay(value: unknown): string | null {
  const text = String(value ?? "");
  if (!DATE_PATTERN.test(text)) return null;
  const date = new Date(`${text}T00:00:00Z`);
  return Number.isFinite(date.getTime()) &&
    date.toISOString().slice(0, 10) === text
    ? text
    : null;
}

function shiftDay(day: string, days: number) {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/**
 * The window of whole calendar months to show. Without `before` it ends open
 * (future-dated records still show) and starts `months - 1` months before
 * today's month. With `before` (exclusive) it covers the `months` months
 * ending with the day before it.
 */
export function timelineWindow(
  before: string | null,
  today: string,
  months = TIMELINE_WINDOW_MONTHS,
): { start: string; end: string | null } {
  const reference = before ? shiftDay(before, -1) : today;
  const [year, month] = reference.split("-").map(Number);
  const start = new Date(Date.UTC(year, month - 1 - (months - 1), 1));
  return { start: start.toISOString().slice(0, 10), end: before };
}

/**
 * Newest first. Same-day entries are ordered by odometer (higher first, since
 * it happened later); entries without a reading sink below those that have
 * one. The kind order and id keep the result stable.
 */
export function compareTimelineEntries(a: TimelineEntry, b: TimelineEntry) {
  if (a.date !== b.date) return a.date < b.date ? 1 : -1;
  const aKm = a.odometerKm ?? -1;
  const bKm = b.odometerKm ?? -1;
  if (aKm !== bKm) return bKm - aKm;
  const kindOrder =
    TIMELINE_KINDS.indexOf(a.kind) - TIMELINE_KINDS.indexOf(b.kind);
  if (kindOrder !== 0) return kindOrder;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

export function mergeTimeline(...sources: TimelineEntry[][]): TimelineEntry[] {
  return sources.flat().sort(compareTimelineEntries);
}

export function filterTimeline(
  entries: TimelineEntry[],
  filter: TimelineFilter,
): TimelineEntry[] {
  return filter === "all"
    ? entries
    : entries.filter((entry) => entry.kind === filter);
}

/** Groups an already-sorted stream into months, keeping its order. */
export function groupTimelineByMonth(
  entries: TimelineEntry[],
): TimelineMonth[] {
  const months: TimelineMonth[] = [];
  for (const entry of entries) {
    const key = entry.date.slice(0, 7);
    let month: TimelineMonth | undefined = months[months.length - 1];
    if (!month || month.key !== key) {
      month = months.find((candidate) => candidate.key === key);
      if (!month) {
        month = { key, entries: [], totalCents: 0 };
        months.push(month);
      }
    }
    month.entries.push(entry);
    if (entry.currency.toUpperCase() === TIMELINE_TOTAL_CURRENCY)
      month.totalCents += entry.amountCents;
  }
  return months;
}

type Row = Record<string, unknown>;

const text = (value: unknown) => String(value ?? "").trim();
const numberOrNull = (value: unknown) => {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};
const cents = (value: unknown) => Math.round(numberOrNull(value) ?? 0);
const currency = (value: unknown) =>
  text(value).toUpperCase() || TIMELINE_TOTAL_CURRENCY;

function baseEntry(
  row: Row,
  kind: TimelineKind,
  subkind: TimelineSubkind,
  dateColumn: string,
): Pick<
  TimelineEntry,
  | "id"
  | "kind"
  | "subkind"
  | "date"
  | "currency"
  | "motorcycleId"
  | "motorcycleName"
  | "href"
> {
  return {
    id: `${subkind}:${text(row.id)}`,
    kind,
    subkind,
    date: isoDateValue(row[dateColumn]),
    currency: currency(row.currency),
    motorcycleId: row.motorcycle_id ? text(row.motorcycle_id) : null,
    motorcycleName: text(row.motorcycle_name),
    href: TIMELINE_HREF[kind],
  };
}

export function fuelEntry(row: Row): TimelineEntry {
  return {
    ...baseEntry(row, "fuel", "fuel", "date"),
    odometerKm: numberOrNull(row.odometer_km),
    amountCents: cents(row.total_price_cents),
    label: "",
    detail: text(row.station_name),
    liters: numberOrNull(row.liters),
    position: null,
  };
}

export function maintenanceEntry(row: Row): TimelineEntry {
  return {
    ...baseEntry(row, "maintenance", "maintenance", "date"),
    odometerKm: numberOrNull(row.odometer_km),
    amountCents: cents(row.cost_cents),
    label: text(row.maintenance_type) || text(row.description),
    detail: text(row.workshop),
    liters: null,
    position: null,
  };
}

export function tireEntry(row: Row): TimelineEntry {
  return {
    ...baseEntry(row, "tires", "tires", "installed_at"),
    odometerKm: numberOrNull(row.installed_odometer_km),
    amountCents: cents(row.cost_cents),
    label: text(row.brand_model),
    detail: "",
    liters: null,
    position: text(row.position) || null,
  };
}

export function feeEntry(row: Row): TimelineEntry {
  return {
    ...baseEntry(row, "expenses", "fee", "date"),
    odometerKm: null,
    amountCents: cents(row.amount_cents),
    label: text(row.fee_type),
    detail: row.year ? text(row.year) : "",
    liters: null,
    position: null,
  };
}

export function insuranceEntry(row: Row): TimelineEntry {
  return {
    ...baseEntry(row, "expenses", "insurance", "coverage_start"),
    odometerKm: null,
    amountCents: cents(row.premium_cents),
    label: "",
    detail: text(row.provider),
    liters: null,
    position: null,
  };
}

export type TimelineQuery = {
  ownerId: string;
  /** null = every bike, including records not linked to one. */
  motorcycleId: string | null;
  filter: TimelineFilter;
  start: string;
  end: string | null;
  today: string;
};

/**
 * Reads one window of the owner's timeline. Every query filters by
 * `owner_id`, and each join to `motorcycles` repeats the owner match, the same
 * scoping the per-feature page loads use. Sources fail open (like those loads)
 * so one broken table does not blank the page; `failed` reports it.
 *
 * Also returns the newest day older than the window, so "see more" can jump
 * straight to the next month that has records instead of an empty page.
 */
export async function loadTimeline(db: Sql, query: TimelineQuery) {
  const { ownerId, motorcycleId, filter, start, end, today } = query;
  const wants = (kind: TimelineKind) => filter === "all" || filter === kind;
  let failed = false;
  const safe = (pending: PromiseLike<Row[]>) =>
    Promise.resolve(pending).catch(() => {
      failed = true;
      return [] as Row[];
    });
  const skip = Promise.resolve([] as Row[]);
  const bike = (alias: string) =>
    motorcycleId
      ? db`and ${db(`${alias}.motorcycle_id`)} = ${motorcycleId}`
      : db``;
  const upper = (column: string) =>
    end ? db`and ${db(column)} < ${end}` : db``;

  const [fuel, maintenance, tires, fees, insurance, olderDay] =
    await Promise.all([
      wants("fuel")
        ? safe(db<Row[]>`
            select f.id, f.motorcycle_id, f.date::text as date, f.odometer_km,
              f.liters, f.total_price_cents, f.currency, f.station_name,
              m.name as motorcycle_name
            from fuel_records f
            left join motorcycles m on m.id = f.motorcycle_id and m.owner_id = f.owner_id
            where f.owner_id = ${ownerId} ${bike("f")}
              and f.date >= ${start} ${upper("f.date")}
            order by f.date desc, f.odometer_km desc
            limit 500
          `)
        : skip,
      wants("maintenance")
        ? safe(db<Row[]>`
            select r.id, r.motorcycle_id, r.date::text as date, r.odometer_km,
              r.maintenance_type, r.description, r.cost_cents, r.currency,
              r.workshop, m.name as motorcycle_name
            from maintenance_records r
            left join motorcycles m on m.id = r.motorcycle_id and m.owner_id = r.owner_id
            where r.owner_id = ${ownerId} ${bike("r")}
              and r.date >= ${start} ${upper("r.date")}
            order by r.date desc, r.odometer_km desc
            limit 500
          `)
        : skip,
      wants("tires")
        ? safe(db<Row[]>`
            select t.id, t.motorcycle_id, t.installed_at::text as installed_at,
              t.installed_odometer_km, t.position, t.brand_model, t.cost_cents,
              t.currency, m.name as motorcycle_name
            from tire_records t
            left join motorcycles m on m.id = t.motorcycle_id and m.owner_id = t.owner_id
            where t.owner_id = ${ownerId} ${bike("t")}
              and t.installed_at >= ${start} ${upper("t.installed_at")}
            order by t.installed_at desc, t.installed_odometer_km desc
            limit 500
          `)
        : skip,
      // A fee is history once paid, or once its due date has passed; an
      // unpaid future fee is still a reminder, not something that happened.
      wants("expenses")
        ? safe(db<Row[]>`
            select a.id, a.motorcycle_id,
              coalesce(a.paid_date, a.due_date)::text as date, a.fee_type,
              a.year, a.amount_cents, a.currency, m.name as motorcycle_name
            from annual_fees a
            left join motorcycles m on m.id = a.motorcycle_id and m.owner_id = a.owner_id
            where a.owner_id = ${ownerId} ${bike("a")}
              and (a.paid_date is not null or a.due_date <= ${today})
              and coalesce(a.paid_date, a.due_date) >= ${start}
              ${end ? db`and coalesce(a.paid_date, a.due_date) < ${end}` : db``}
            order by coalesce(a.paid_date, a.due_date) desc
            limit 500
          `)
        : skip,
      wants("expenses")
        ? safe(db<Row[]>`
            select i.id, i.motorcycle_id, i.coverage_start::text as coverage_start,
              i.provider, i.premium_cents, i.currency, m.name as motorcycle_name
            from insurance_policies i
            left join motorcycles m on m.id = i.motorcycle_id and m.owner_id = i.owner_id
            where i.owner_id = ${ownerId} ${bike("i")}
              and i.coverage_start >= ${start} ${upper("i.coverage_start")}
            order by i.coverage_start desc
            limit 500
          `)
        : skip,
      safe(db<Row[]>`
        select greatest(
          ${
            wants("fuel")
              ? db`(select max(f.date) from fuel_records f
                  where f.owner_id = ${ownerId} ${bike("f")} and f.date < ${start})`
              : db`null::date`
          },
          ${
            wants("maintenance")
              ? db`(select max(r.date) from maintenance_records r
                  where r.owner_id = ${ownerId} ${bike("r")} and r.date < ${start})`
              : db`null::date`
          },
          ${
            wants("tires")
              ? db`(select max(t.installed_at) from tire_records t
                  where t.owner_id = ${ownerId} ${bike("t")} and t.installed_at < ${start})`
              : db`null::date`
          },
          ${
            wants("expenses")
              ? db`(select max(coalesce(a.paid_date, a.due_date)) from annual_fees a
                  where a.owner_id = ${ownerId} ${bike("a")}
                    and (a.paid_date is not null or a.due_date <= ${today})
                    and coalesce(a.paid_date, a.due_date) < ${start})`
              : db`null::date`
          },
          ${
            wants("expenses")
              ? db`(select max(i.coverage_start) from insurance_policies i
                  where i.owner_id = ${ownerId} ${bike("i")} and i.coverage_start < ${start})`
              : db`null::date`
          }
        )::text as day
      `).then(([row]) => parseCalendarDay(row?.day)),
    ]);

  const entries = mergeTimeline(
    fuel.map(fuelEntry),
    maintenance.map(maintenanceEntry),
    tires.map(tireEntry),
    fees.map(feeEntry),
    insurance.map(insuranceEntry),
  );
  return { entries, olderDay, failed };
}

/** `?before=` for the next page: the day after the newest older record. */
export function nextBefore(olderDay: string | null): string | null {
  return olderDay ? shiftDay(olderDay, 1) : null;
}
