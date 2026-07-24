import { fail } from "@sveltejs/kit";
import type { Sql } from "postgres";
import {
  FREE_ACTIVE_MOTORCYCLE_LIMIT,
  hasProAccess,
  type SubscriptionProfile,
} from "$server/domain/entitlements";
import { archiveMotorcycle, restoreMotorcycle } from "$server/domain/parity";
import { syncMotorcycleOdometer } from "$server/domain/odometer";

type Row = Record<string, unknown>;

function value(form: FormData, key: string) {
  return String(form.get(key) ?? "").trim();
}

function messageFrom(err: unknown) {
  return err instanceof Error ? err.message : String(err);
}

// The Supabase version never checked `{ error }` on these reads — a failed
// query just fell back to an empty result. Reproduce that swallow instead of
// letting postgres.js's thrown errors turn the page load into a 500.
function rowsOrEmpty<T>(promise: Promise<T[]>): Promise<T[]> {
  return promise.catch(() => [] as T[]);
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
  const [motorcycles, profileRows] = await Promise.all([
    rowsOrEmpty(
      locals.db<Row[]>`
        select * from motorcycles
        where owner_id = ${ownerId}
        order by is_active desc, name asc
      `,
    ),
    rowsOrEmpty(
      locals.db<SubscriptionProfile[]>`
        select plan, stripe_subscription_status, grace_until
        from subscription_profiles
        where owner_id = ${ownerId}
      `,
    ),
  ]);
  const profile = profileRows[0];

  const motorcycleIds = motorcycles.map((motorcycle) => String(motorcycle.id));
  const specs = motorcycleIds.length
    ? await rowsOrEmpty(
        locals.db<Row[]>`
          select * from motorcycle_specs
          where motorcycle_id in ${locals.db(motorcycleIds)}
        `,
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

  return {
    motorcycles: motorcyclesWithSpecs,
    canAddActive:
      hasProAccess(profile) ||
      motorcyclesWithSpecs.filter((motorcycle) => motorcycle.is_active).length <
        FREE_ACTIVE_MOTORCYCLE_LIMIT,
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
    const brand = value(form, "brand");
    const model = value(form, "model");
    const year = Number(form.get("year"));
    if (!name || !brand || !model || !Number.isInteger(year)) {
      return fail(400, {
        message: "Informe nome, marca, modelo e ano válidos.",
      });
    }
    try {
      await locals.db`
        insert into motorcycles ${locals.db({
          owner_id: ownerId,
          name,
          brand,
          model,
          year,
          current_odometer_km: Math.max(
            0,
            Number(form.get("current_odometer_km") ?? 0),
          ),
          is_active: true,
        })}
      `;
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
