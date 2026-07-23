import { fail } from "@sveltejs/kit";
import {
  deleteOwnedRow,
  featureActions,
  loadFeature,
} from "$server/domain/crud";

const base = featureActions("tires");
const v = (f: FormData, k: string) => String(f.get(k) ?? "").trim();

export const actions = {
  ...base,
  saveProduct: async ({ request, locals }) => {
    const f = await request.formData();
    const { error } = await locals.supabase.from("tire_products").insert({
      owner_id: locals.user!.id,
      manufacturer: v(f, "manufacturer"),
      model_name: v(f, "model_name"),
      tire_type: v(f, "tire_type") || "street",
      price_cents: Math.round(Number(f.get("price") ?? 0) * 100),
    });
    return error ? fail(400, { message: error.message }) : { ok: true };
  },
  deleteProduct: async ({ request, locals }) => {
    const f = await request.formData();
    const error = await deleteOwnedRow(
      locals.supabase,
      "tire_products",
      v(f, "id"),
      locals.user!.id,
    );
    return error ? fail(400, { message: error.message }) : { ok: true };
  },
  savePressure: async ({ request, locals }) => {
    const f = await request.formData();
    const { error } = await locals.supabase
      .from("tire_pressure_records")
      .insert({
        owner_id: locals.user!.id,
        motorcycle_id: v(f, "motorcycle_id"),
        date: v(f, "date"),
        psi_front: Number(f.get("psi_front")),
        psi_rear: Number(f.get("psi_rear")),
        notes: v(f, "notes"),
      });
    return error ? fail(400, { message: error.message }) : { ok: true };
  },
  deletePressure: async ({ request, locals }) => {
    const f = await request.formData();
    const error = await deleteOwnedRow(
      locals.supabase,
      "tire_pressure_records",
      v(f, "id"),
      locals.user!.id,
    );
    return error ? fail(400, { message: error.message }) : { ok: true };
  },
};

export async function load({ locals }) {
  const baseData = await loadFeature(locals.supabase, "tires", locals.user!);
  const [products, pressures] = await Promise.all([
    locals.supabase
      .from("tire_products")
      .select("*")
      .eq("owner_id", locals.user!.id)
      .order("manufacturer"),
    locals.supabase
      .from("tire_pressure_records")
      .select("*, motorcycles(name)")
      .eq("owner_id", locals.user!.id)
      .order("date", { ascending: false }),
  ]);
  return {
    ...baseData,
    products: (products.data ?? []) as Array<{
      id: string;
      manufacturer: string;
      model_name: string;
      tire_type: string;
      price_cents: number | null;
    }>,
    pressures: (pressures.data ?? []) as Array<{
      id: string;
      date: string;
      psi_front: number;
      psi_rear: number;
      motorcycles: { name: string } | null;
    }>,
  };
}
