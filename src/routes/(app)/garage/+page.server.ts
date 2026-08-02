import { fail } from "@sveltejs/kit";
import type { Sql } from "postgres";
import {
  FREE_ACTIVE_MOTORCYCLE_LIMIT,
  hasProAccess,
  type SubscriptionProfile,
} from "$server/domain/entitlements";
import { archiveMotorcycle, restoreMotorcycle } from "$server/domain/parity";
import { syncMotorcycleOdometer } from "$server/domain/odometer";
import {
  applyMotorcycleTemplate,
  catalogYears,
  getTemplateForYear,
  listVisibleMotorcycleCatalog,
} from "$server/domain/motorcycle-catalog";
import { translate } from "$lib/i18n";

type Row = Record<string, unknown>;
type TemplateDocument = {
  template_id: string;
  title: string;
  document_type: string;
  external_url: string;
  notes: string;
};
type ManualSource = {
  template_id: string;
  official_url: string;
  document_version: string;
  page_reference: string;
  last_verified_date: string;
  coverage_notes: string;
};

function value(form: FormData, key: string) {
  return String(form.get(key) ?? "").trim();
}

function messageFrom(err: unknown) {
  return err instanceof Error ? err.message : String(err);
}

// The Supabase version never checked `{ error }` on these reads — a failed
// query just fell back to an empty result. Reproduce that swallow instead of
// letting postgres.js's thrown errors turn the page load into a 500.
function rowsOrEmpty<T>(
  promise: Promise<T[]>,
  onError: () => void,
): Promise<T[]> {
  return promise.catch(() => {
    onError();
    return [] as T[];
  });
}

// Shared by `create` and `restore`, which both re-run the same active-slot
// check before touching a motorcycle's `is_active` state. Neither the count
// nor the profile lookup ever checked `{ error }` in the Supabase version —
// a failed read just defaulted to 0 / no profile, same as here.
async function canAddActiveMotorcycle(db: Sql, ownerId: string) {
  let activeCount = 0;
  try {
    const [row] = await db<{ count: number }[]>`
      select count(*)::int as count from motorcycles
      where owner_id = ${ownerId} and is_active = true
    `;
    activeCount = row?.count ?? 0;
  } catch {
    activeCount = 0;
  }

  let profile: SubscriptionProfile | undefined;
  try {
    [profile] = await db<SubscriptionProfile[]>`
      select plan, stripe_subscription_status, grace_until
      from subscription_profiles
      where owner_id = ${ownerId}
    `;
  } catch {
    profile = undefined;
  }

  return hasProAccess(profile) || activeCount < FREE_ACTIVE_MOTORCYCLE_LIMIT;
}

export async function load({ locals }) {
  const ownerId = locals.user!.id;
  let loadError = false;
  const markLoadError = () => {
    loadError = true;
  };
  const [motorcycles, profileRows, templates] = await Promise.all([
    rowsOrEmpty(
      locals.db<Row[]>`
        select * from motorcycles
        where owner_id = ${ownerId}
        order by is_active desc, name asc
      `,
      markLoadError,
    ),
    rowsOrEmpty(
      locals.db<SubscriptionProfile[]>`
        select plan, stripe_subscription_status, grace_until
        from subscription_profiles
        where owner_id = ${ownerId}
      `,
      markLoadError,
    ),
    rowsOrEmpty(listVisibleMotorcycleCatalog(locals.db), markLoadError),
  ]);
  const profile = profileRows[0];

  const motorcycleIds = motorcycles.map((motorcycle) => String(motorcycle.id));
  const specs = motorcycleIds.length
    ? await rowsOrEmpty(
        locals.db<Row[]>`
          select * from motorcycle_specs
          where motorcycle_id in ${locals.db(motorcycleIds)}
        `,
        markLoadError,
      )
    : [];
  const specsByMotorcycle = new Map(
    specs.map((spec) => [String(spec.motorcycle_id), spec]),
  );
  // Explicit generic on `.map` (rather than letting it infer): spreading a
  // `Record<string, unknown>` alongside a literal property otherwise makes
  // TS drop the index signature from the result, which then rejects every
  // `motorcycle.<column>` access downstream (including in +page.svelte).
  const motorcyclesWithSpecs = motorcycles.map<
    Row & { motorcycle_specs: Row[] }
  >((motorcycle) => ({
    ...motorcycle,
    motorcycle_specs: [specsByMotorcycle.get(String(motorcycle.id))].filter(
      (spec): spec is Row => Boolean(spec),
    ),
  }));

  const templateIds = motorcyclesWithSpecs
    .map((motorcycle) => String(motorcycle.source_template_id ?? ""))
    .filter(Boolean);
  const [documents, manualSources] = templateIds.length
    ? await Promise.all([
        rowsOrEmpty(
          locals.db<TemplateDocument[]>`
          select template_id, title, document_type, external_url, notes
          from motorcycle_template_documents
          where template_id in ${locals.db(templateIds)}
          order by title
        `,
          markLoadError,
        ),
        rowsOrEmpty(
          locals.db<ManualSource[]>`
          select template_id, official_url, document_version, page_reference,
            last_verified_date::text, coverage_notes
          from motorcycle_manual_sources
          where template_id in ${locals.db(templateIds)}
        `,
          markLoadError,
        ),
      ])
    : [[], []];
  const documentsByTemplate = new Map<string, TemplateDocument[]>();
  for (const document of documents) {
    const templateId = String(document.template_id);
    documentsByTemplate.set(templateId, [
      ...(documentsByTemplate.get(templateId) ?? []),
      document,
    ]);
  }
  const sourceByTemplate = new Map(
    manualSources.map((source) => [source.template_id, source]),
  );

  return {
    motorcycles: motorcyclesWithSpecs.map<
      Row & {
        motorcycle_specs: Row[];
        template_documents: TemplateDocument[];
        manual_source: ManualSource | null;
      }
    >((motorcycle) => ({
      ...motorcycle,
      template_documents:
        documentsByTemplate.get(String(motorcycle.source_template_id ?? "")) ??
        [],
      manual_source:
        sourceByTemplate.get(String(motorcycle.source_template_id ?? "")) ??
        null,
    })),
    templates: templates.map((template) => ({
      ...template,
      available_years: catalogYears(template),
    })),
    canAddActive:
      hasProAccess(profile) ||
      motorcyclesWithSpecs.filter((motorcycle) => motorcycle.is_active).length <
        FREE_ACTIVE_MOTORCYCLE_LIMIT,
    errorMessage: loadError ? translate(locals.locale, "common.loadError") : "",
  };
}

export const actions = {
  create: async ({ request, locals }) => {
    const form = await request.formData();
    const ownerId = locals.user!.id;
    if (!(await canAddActiveMotorcycle(locals.db, ownerId))) {
      return fail(403, { message: "O plano Free permite uma moto ativa." });
    }
    const name = value(form, "name");
    let brand = value(form, "brand");
    let model = value(form, "model");
    const year = Number(form.get("year"));
    const currentYear = new Date().getFullYear();
    if (
      !name ||
      !brand ||
      !model ||
      !Number.isInteger(year) ||
      year <= 1900 ||
      year > currentYear
    ) {
      return fail(400, {
        message: "Informe nome, marca, modelo e ano válidos.",
      });
    }
    const enteredOdometer = Number(form.get("current_odometer_km") ?? 0);
    if (!Number.isFinite(enteredOdometer) || enteredOdometer < 0) {
      return fail(400, { message: "Odômetro inválido." });
    }
    const currentOdometerKm = Math.trunc(enteredOdometer);
    const templateId = value(form, "template_id") || null;
    if (templateId) {
      const template = await getTemplateForYear(locals.db, templateId, year);
      if (!template)
        return fail(400, {
          message: "Escolha um ano disponível para o modelo.",
        });
      brand = template.brand;
      model = template.model;
    }
    const motorcycleId = crypto.randomUUID();
    try {
      await locals.db.begin(async (tx) => {
        await tx`
          insert into motorcycles ${tx({
            id: motorcycleId,
            owner_id: ownerId,
            name,
            brand,
            model,
            year,
            source_template_id: templateId,
            current_odometer_km: currentOdometerKm,
            is_active: true,
          })}
        `;
        if (templateId) {
          await applyMotorcycleTemplate(
            // See the onboarding equivalent: the helper only uses the shared
            // tagged-query surface, which transactions provide at runtime.
            tx as unknown as typeof locals.db,
            ownerId,
            motorcycleId,
            templateId,
            currentOdometerKm,
          );
        }
      });
    } catch (err) {
      return fail(400, { message: messageFrom(err) });
    }
    return { ok: true };
  },
  archive: async ({ request, locals }) => {
    const form = await request.formData();
    try {
      await locals.db`
        update motorcycles
        set ${locals.db(archiveMotorcycle())}
        where id = ${value(form, "id")} and owner_id = ${locals.user!.id}
      `;
    } catch (err) {
      return fail(400, { message: messageFrom(err) });
    }
    return { ok: true };
  },
  restore: async ({ request, locals }) => {
    const form = await request.formData();
    const ownerId = locals.user!.id;
    if (!(await canAddActiveMotorcycle(locals.db, ownerId))) {
      return fail(403, { message: "O plano Free permite uma moto ativa." });
    }
    try {
      await locals.db`
        update motorcycles
        set ${locals.db(restoreMotorcycle())}
        where id = ${value(form, "id")} and owner_id = ${ownerId}
      `;
    } catch (err) {
      return fail(400, { message: messageFrom(err) });
    }
    return { ok: true };
  },
  saveSpecs: async ({ request, locals }) => {
    const form = await request.formData();
    const motorcycleId = value(form, "motorcycle_id");
    const ownerId = locals.user!.id;
    try {
      // `motorcycle_specs` has no owner_id column of its own — RLS used to
      // enforce ownership via a join to `motorcycles`. With RLS gone, verify
      // the motorcycle belongs to the caller before writing its specs.
      const [owned] = await locals.db<{ id: string }[]>`
        select id from motorcycles
        where id = ${motorcycleId} and owner_id = ${ownerId}
      `;
      if (!owned) return fail(400, { message: "Motocicleta não encontrada." });

      await locals.db`
        insert into motorcycle_specs ${locals.db({
          motorcycle_id: motorcycleId,
          tire_size_front: value(form, "tire_size_front"),
          tire_size_rear: value(form, "tire_size_rear"),
          recommended_tire_pressure_front: value(
            form,
            "recommended_tire_pressure_front",
          ),
          recommended_tire_pressure_rear: value(
            form,
            "recommended_tire_pressure_rear",
          ),
          manual_reference: value(form, "manual_reference"),
        })}
        on conflict (motorcycle_id) do update set
          tire_size_front = excluded.tire_size_front,
          tire_size_rear = excluded.tire_size_rear,
          recommended_tire_pressure_front = excluded.recommended_tire_pressure_front,
          recommended_tire_pressure_rear = excluded.recommended_tire_pressure_rear,
          manual_reference = excluded.manual_reference
      `;
    } catch (err) {
      return fail(400, { message: messageFrom(err) });
    }
    return { ok: true };
  },
  updateOdometer: async ({ request, locals }) => {
    const form = await request.formData();
    const motorcycleId = value(form, "motorcycle_id");
    const override = Number(form.get("odometer_override_km"));
    if (!motorcycleId || !Number.isInteger(override) || override < 0) {
      return fail(400, { message: "Odômetro inválido." });
    }
    const ownerId = locals.user!.id;
    try {
      await locals.db`
        update motorcycles
        set odometer_override_km = ${override},
          odometer_override_at = ${new Date().toISOString()}
        where id = ${motorcycleId} and owner_id = ${ownerId}
      `;
    } catch (err) {
      return fail(400, { message: messageFrom(err) });
    }
    await syncMotorcycleOdometer(locals.db, ownerId, motorcycleId);
    return { ok: true };
  },
};
