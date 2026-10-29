import { error, fail } from "@sveltejs/kit";
import type { RequestEvent } from "@sveltejs/kit";
import { workshopMessages } from "$lib/i18n/workshop-comparison";
import {
  WORKSHOP_STATES,
  WorkshopBenchmarkError,
  safeWorkshopSummary,
  saveWorkshopContribution,
  withdrawWorkshopContribution,
  workshopDisplayName,
  workshopIdentity,
  workshopRecordEligible,
  workshopRegion,
  type WorkshopRecord,
} from "$server/domain/workshop-benchmark";
import { isoDateValue } from "$server/domain/date-value";

type OwnContribution = {
  record_id: string;
  workshop_name: string;
  source_service: string;
  serviced_on: string | Date;
  city_name: string;
  state_code: string;
  labor_cents: number;
  current: boolean;
};

const formValue = (form: FormData, key: string) =>
  String(form.get(key) ?? "").trim();
function owner(locals: App.Locals) {
  if (!locals.user) error(401, "Authentication required");
  return locals.user.id;
}

export async function load({
  locals,
  url,
}: Pick<RequestEvent, "locals" | "url">) {
  const ownerId = owner(locals);
  const filters = {
    service: workshopDisplayName(url.searchParams.get("service")).slice(0, 121),
    city: workshopDisplayName(url.searchParams.get("city")).slice(0, 121),
    state: String(url.searchParams.get("state") ?? "")
      .trim()
      .toUpperCase(),
  };
  const region = workshopRegion(filters.city, filters.state);
  const serviceKey = workshopIdentity(filters.service);
  const requested = Boolean(filters.service || filters.city || filters.state);
  const validSearch = Boolean(region && serviceKey);
  try {
    const [records, contributions, summaries] = await Promise.all([
      locals.db<WorkshopRecord[]>`
        select id, workshop, maintenance_type, date, cost_cents, currency
        from maintenance_records where owner_id = ${ownerId}
        order by date desc, id limit 500
      `,
      locals.db<OwnContribution[]>`
        select g.record_id, c.workshop_name, g.source_service, g.serviced_on,
          c.city_name, c.state_code, c.labor_cents,
          (r.workshop = g.source_workshop and r.maintenance_type = g.source_service
            and r.date = g.serviced_on and r.cost_cents = g.source_total_cents
            and r.currency = 'BRL' and r.date <= current_date
            and c.labor_cents <= r.cost_cents) as current
        from workshop_benchmark_submission_guards g
        join anonymous_workshop_benchmark_contributions c on c.id = g.contribution_id
        join maintenance_records r on r.id = g.record_id and r.owner_id = g.owner_id
        where g.owner_id = ${ownerId} order by g.updated_at desc
      `,
      validSearch
        ? locals.db<Array<Record<string, unknown>>>`
            select workshop_name, sample_size, average_labor_cents
            from workshop_benchmark_summary(${serviceKey}, ${region!.cityKey}, ${region!.stateCode})
          `
        : Promise.resolve([]),
    ]);
    return {
      filters,
      requested,
      validSearch,
      states: WORKSHOP_STATES,
      loadError: false,
      records: records
        .filter((record) => workshopRecordEligible(record))
        .map((record) => ({
          ...record,
          date: isoDateValue(record.date),
          cost_cents: Number(record.cost_cents),
        })),
      contributions: contributions.map((row) => ({
        ...row,
        serviced_on: isoDateValue(row.serviced_on),
        labor_cents: Number(row.labor_cents),
      })),
      summaries: summaries
        .map(safeWorkshopSummary)
        .filter((row) => row !== null),
    };
  } catch {
    return {
      filters,
      requested,
      validSearch,
      states: WORKSHOP_STATES,
      loadError: true,
      records: [],
      contributions: [],
      summaries: [],
    };
  }
}

export const actions = {
  contribute: async ({
    request,
    locals,
  }: Pick<RequestEvent, "request" | "locals">) => {
    const ownerId = owner(locals);
    const text = workshopMessages(locals.locale);
    const form = await request.formData();
    const values = {
      recordId: formValue(form, "record_id"),
      laborAmount: formValue(form, "labor_amount"),
      city: formValue(form, "city"),
      state: formValue(form, "state"),
    };
    try {
      await saveWorkshopContribution(locals.db, ownerId, {
        ...values,
        consent: ["true", "on", "1"].includes(formValue(form, "consent")),
      });
      return { saved: true };
    } catch (err) {
      return fail(err instanceof WorkshopBenchmarkError ? err.status : 500, {
        message:
          err instanceof WorkshopBenchmarkError
            ? text[err.code]
            : text.saveError,
        values,
      });
    }
  },
  withdraw: async ({
    request,
    locals,
  }: Pick<RequestEvent, "request" | "locals">) => {
    const ownerId = owner(locals);
    const text = workshopMessages(locals.locale);
    const form = await request.formData();
    try {
      await withdrawWorkshopContribution(
        locals.db,
        ownerId,
        formValue(form, "record_id"),
      );
      return { withdrawn: true };
    } catch (err) {
      return fail(err instanceof WorkshopBenchmarkError ? err.status : 500, {
        message:
          err instanceof WorkshopBenchmarkError
            ? text[err.code]
            : text.withdrawError,
      });
    }
  },
};
