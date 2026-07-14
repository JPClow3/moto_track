import { error } from "@sveltejs/kit";

export async function load({ locals, params }) {
  const [motorcycle, fuel, maintenance, tires, fees] = await Promise.all([
    locals.supabase.from("motorcycles").select("*").eq("id", params.motorcycleId).eq("owner_id", locals.user!.id).maybeSingle(),
    locals.supabase.from("fuel_records").select("total_price_cents").eq("motorcycle_id", params.motorcycleId).eq("owner_id", locals.user!.id),
    locals.supabase.from("maintenance_records").select("cost_cents").eq("motorcycle_id", params.motorcycleId).eq("owner_id", locals.user!.id),
    locals.supabase.from("tire_records").select("cost_cents").eq("motorcycle_id", params.motorcycleId).eq("owner_id", locals.user!.id),
    locals.supabase.from("annual_fees").select("amount_cents").eq("motorcycle_id", params.motorcycleId).eq("owner_id", locals.user!.id),
  ]);
  if (!motorcycle.data) throw error(404, "Motorcycle not found");
  const sum=(rows: Array<Record<string, unknown>> | null, key:string)=> (rows ?? []).reduce((total,row)=>total+Number(row[key] ?? 0),0);
  return { motorcycle: motorcycle.data, totals: { fuel: sum(fuel.data,"total_price_cents"), maintenance: sum(maintenance.data,"cost_cents"), tires: sum(tires.data,"cost_cents"), fees: sum(fees.data,"amount_cents") } };
}
