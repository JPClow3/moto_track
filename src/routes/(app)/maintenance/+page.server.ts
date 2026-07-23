import { fail } from "@sveltejs/kit";
import { featureActions, loadFeature } from "$server/domain/crud";

type Row = Record<string, unknown>;

function messageFrom(err: unknown) {
  return err instanceof Error ? err.message : String(err);
}

const base = featureActions("maintenance");
const v = (f: FormData, k: string) => String(f.get(k) ?? "").trim();

export const actions = {
  ...base,
  savePart: async ({ request, locals }) => {
    const f = await request.formData();
    try {
      await locals.db`
        insert into maintenance_parts ${locals.db({
          owner_id: locals.user!.id,
          name: v(f, "name"),
          manufacturer: v(f, "manufacturer"),
          part_type: v(f, "part_type") || "other",
          price_cents: Math.round(Number(f.get("price") ?? 0) * 100),
          track_stock: f.get("track_stock") === "true",
          stock_quantity: Number(f.get("stock_quantity") ?? 0),
        })}
      `;
    } catch (err) {
      return fail(400, { message: messageFrom(err) });
    }
    return { ok: true };
  },
  savePlan: async ({ request, locals }) => {
    const f = await request.formData();
    const ownerId = locals.user!.id;
    const motorcycleId = v(f, "motorcycle_id");
    const type = v(f, "maintenance_type");

    // The Supabase version upserted without an explicit onConflict target, so
    // it defaulted to the primary key (`id`) — which the payload never sets,
    // meaning it always inserted a fresh row rather than merging by
    // (motorcycle_id, maintenance_type, is_severe_duty_override). A plain
    // insert reproduces that exactly: it still fails with the same
    // unique-constraint error if that combo already exists.
    let plan: { id: string } | undefined;
    try {
      [plan] = await locals.db<Array<{ id: string }>>`
        insert into maintenance_plan_items ${locals.db({
          owner_id: ownerId,
          motorcycle_id: motorcycleId,
          maintenance_type: type,
          interval_km: Number(f.get("interval_km")) || null,
          interval_days: Number(f.get("interval_days")) || null,
          is_active: true,
        })}
        returning id
      `;
    } catch (err) {
      return fail(400, { message: messageFrom(err) });
    }
    if (!plan) return fail(400, { message: "Plano inválido." });

    // The Supabase version never checked this insert's error either.
    try {
      await locals.db`
        insert into reminders ${locals.db({
          owner_id: ownerId,
          motorcycle_id: motorcycleId,
          title: `Plano: ${type}`,
          trigger_type: Number(f.get("interval_km"))
            ? "by_interval"
            : "by_date",
          trigger_value_km: Number(f.get("interval_km")) || null,
          trigger_value_days: Number(f.get("interval_days")) || null,
          is_active: true,
          linked_plan_item_id: plan.id,
        })}
      `;
    } catch {
      // Ignored — see comment above.
    }
    return { ok: true };
  },
};

export async function load({ locals }) {
  const ownerId = locals.user!.id;
  const baseData = await loadFeature(locals.db, "maintenance", locals.user!);
  const [parts, plans, photos] = await Promise.all([
    locals.db<Row[]>`
      select * from maintenance_parts where owner_id = ${ownerId}
    `.catch(() => [] as Row[]),
    locals.db<Row[]>`
      select * from maintenance_plan_items where owner_id = ${ownerId}
    `.catch(() => [] as Row[]),
    locals.db<Row[]>`
      select * from maintenance_photos where owner_id = ${ownerId}
    `.catch(() => [] as Row[]),
  ]);
  return {
    ...baseData,
    parts,
    plans,
    photos,
  };
}
