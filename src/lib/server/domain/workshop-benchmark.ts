import type { Sql } from "postgres";
import { isoDateValue } from "./date-value";
import { lockObjectOwner } from "../db/owner-lock";

import { appToday } from "../../utils/calendar-day";
export const WORKSHOP_MIN_ACCOUNTS = 5;
export const WORKSHOP_MAX_LABOR_CENTS = 1_000_000;
export const WORKSHOP_STATES = [
  "AC",
  "AL",
  "AP",
  "AM",
  "BA",
  "CE",
  "DF",
  "ES",
  "GO",
  "MA",
  "MT",
  "MS",
  "MG",
  "PA",
  "PB",
  "PR",
  "PE",
  "PI",
  "RJ",
  "RN",
  "RS",
  "RO",
  "RR",
  "SC",
  "SP",
  "SE",
  "TO",
] as const;

export type WorkshopErrorCode =
  | "consentRequired"
  | "invalidRecord"
  | "ineligibleRecord"
  | "invalidLabor"
  | "laborExceedsTotal"
  | "invalidRegion";

export class WorkshopBenchmarkError extends Error {
  constructor(
    public code: WorkshopErrorCode,
    public status = 400,
  ) {
    super(code);
  }
}

export type WorkshopRecord = {
  id: string;
  workshop: string;
  maintenance_type: string;
  date: string | Date;
  cost_cents: number | string;
  currency: string;
};

export type WorkshopContributionInput = {
  recordId: string;
  laborAmount: string;
  city: string;
  state: string;
  consent: boolean;
};

export type WorkshopSummary = {
  workshop: string;
  accounts: number;
  averageLaborCents: number;
};

export function workshopDisplayName(value: unknown) {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, " ");
}

/** Exact normalized identities only: no fuzzy matching of unrelated services. */
export function workshopIdentity(value: unknown) {
  const text = workshopDisplayName(value);
  if (text.length < 2 || text.length > 120) return "";
  const key = text
    .toLocaleLowerCase("pt-BR")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return key.length >= 2 ? key : "";
}

export function workshopRegion(city: unknown, state: unknown) {
  const cityName = workshopDisplayName(city);
  const cityKey = workshopIdentity(cityName);
  const stateCode = String(state ?? "")
    .trim()
    .toUpperCase();
  if (
    !cityKey ||
    !/\p{Letter}/u.test(cityName) ||
    !(WORKSHOP_STATES as readonly string[]).includes(stateCode)
  )
    return null;
  return { cityName, cityKey, stateCode };
}

export function workshopRecordEligible(
  record: WorkshopRecord,
  today = appToday(),
) {
  const date = isoDateValue(record.date);
  const parsedDate = new Date(`${date}T00:00:00.000Z`);
  const total = Number(record.cost_cents);
  return Boolean(
    workshopIdentity(record.workshop) &&
    workshopIdentity(record.maintenance_type) &&
    !["other", "outro", "outros"].includes(
      workshopIdentity(record.maintenance_type),
    ) &&
    /^\d{4}-\d{2}-\d{2}$/.test(date) &&
    Number.isFinite(parsedDate.getTime()) &&
    parsedDate.toISOString().slice(0, 10) === date &&
    date >= "1900-01-01" &&
    date <= today &&
    Number.isSafeInteger(total) &&
    total > 0 &&
    record.currency === "BRL",
  );
}

export function validateWorkshopContribution(
  input: WorkshopContributionInput,
  record: WorkshopRecord,
  today?: string,
) {
  if (!input.consent) throw new WorkshopBenchmarkError("consentRequired");
  if (input.recordId !== record.id)
    throw new WorkshopBenchmarkError("invalidRecord", 404);
  if (!workshopRecordEligible(record, today)) {
    throw new WorkshopBenchmarkError("ineligibleRecord");
  }
  // Do not silently round extra decimals, accept scientific notation, or infer
  // the labor split from the maintenance's parts-inclusive total.
  const amount = input.laborAmount.trim();
  if (!/^\d{1,5}(?:[.,]\d{1,2})?$/.test(amount)) {
    throw new WorkshopBenchmarkError("invalidLabor");
  }
  const laborCents = Math.round(Number(amount.replace(",", ".")) * 100);
  if (laborCents <= 0 || laborCents > WORKSHOP_MAX_LABOR_CENTS) {
    throw new WorkshopBenchmarkError("invalidLabor");
  }
  if (laborCents > Number(record.cost_cents)) {
    throw new WorkshopBenchmarkError("laborExceedsTotal");
  }
  const region = workshopRegion(input.city, input.state);
  if (!region) throw new WorkshopBenchmarkError("invalidRegion");
  return {
    ...region,
    laborCents,
    workshopKey: workshopIdentity(record.workshop),
    workshopName: workshopDisplayName(record.workshop),
    serviceKey: workshopIdentity(record.maintenance_type),
    servicedOn: isoDateValue(record.date),
  };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function saveWorkshopContribution(
  db: Sql,
  ownerId: string,
  input: WorkshopContributionInput,
) {
  if (!input.consent) throw new WorkshopBenchmarkError("consentRequired");
  if (!UUID.test(input.recordId))
    throw new WorkshopBenchmarkError("invalidRecord", 404);
  await db.begin(async (tx) => {
    // Account deletion locks the owner before cascading into records; the
    // guard's foreign key would otherwise request that lock after the record's.
    await lockObjectOwner(tx as unknown as Sql, ownerId);
    // Lock the source record, so concurrent edits/deletes cannot invalidate the
    // ownership or total checked before this consent snapshot is committed.
    const [record] = await tx<WorkshopRecord[]>`
      select id, workshop, maintenance_type, date, cost_cents, currency
      from maintenance_records
      where id = ${input.recordId} and owner_id = ${ownerId}
      for update
    `;
    if (!record) throw new WorkshopBenchmarkError("invalidRecord", 404);
    const contribution = validateWorkshopContribution(input, record);
    const [guard] = await tx<Array<{ contribution_id: string }>>`
      insert into workshop_benchmark_submission_guards
        (owner_id, record_id, source_workshop, source_service, serviced_on,
         source_total_cents, consented_at)
      values (${ownerId}, ${record.id}, ${record.workshop}, ${record.maintenance_type},
        ${contribution.servicedOn}, ${Number(record.cost_cents)}, now())
      on conflict (owner_id, record_id) do update set
        source_workshop = excluded.source_workshop,
        source_service = excluded.source_service,
        serviced_on = excluded.serviced_on,
        source_total_cents = excluded.source_total_cents,
        consented_at = now(), updated_at = now()
      returning contribution_id
    `;
    if (!guard) throw new Error("Could not reserve workshop contribution");
    await tx`
      insert into anonymous_workshop_benchmark_contributions
        (id, workshop_key, workshop_name, service_key, city_key, city_name, state_code, labor_cents)
      values (${guard.contribution_id}, ${contribution.workshopKey}, ${contribution.workshopName},
        ${contribution.serviceKey}, ${contribution.cityKey}, ${contribution.cityName},
        ${contribution.stateCode}, ${contribution.laborCents})
      on conflict (id) do update set
        workshop_key = excluded.workshop_key, workshop_name = excluded.workshop_name,
        service_key = excluded.service_key, city_key = excluded.city_key,
        city_name = excluded.city_name, state_code = excluded.state_code,
        labor_cents = excluded.labor_cents, updated_at = now()
    `;
  });
}

export async function withdrawWorkshopContribution(
  db: Sql,
  ownerId: string,
  recordId: string,
) {
  if (!UUID.test(recordId))
    throw new WorkshopBenchmarkError("invalidRecord", 404);
  // The anonymous row cascades from its guard. Another account's record can
  // never be withdrawn by submitting its id.
  await db`
    delete from workshop_benchmark_submission_guards
    where owner_id = ${ownerId} and record_id = ${recordId}
  `;
}

/** Defense in depth: never forward a malformed or under-threshold SQL row. */
export function safeWorkshopSummary(
  row: Record<string, unknown>,
): WorkshopSummary | null {
  const accounts = Number(row.sample_size);
  const average = Number(row.average_labor_cents);
  const workshop = workshopDisplayName(row.workshop_name);
  if (
    !Number.isSafeInteger(accounts) ||
    accounts < WORKSHOP_MIN_ACCOUNTS ||
    row.average_labor_cents == null ||
    !Number.isFinite(average) ||
    average <= 0 ||
    average > WORKSHOP_MAX_LABOR_CENTS ||
    !workshopIdentity(workshop)
  )
    return null;
  return { workshop, accounts, averageLaborCents: Math.round(average) };
}
