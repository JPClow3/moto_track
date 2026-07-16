import { dashboardSummary } from "$server/domain/reports";
import { formatMoney } from "$lib/i18n";

export async function load({ locals }) {
  const user = locals.user;
  if (!user) return { metrics: [], alerts: [], motorcycles: [] };

  const [
    { data: motorcycles },
    { data: fuel },
    { data: reminders },
    { data: tires },
    { data: documents },
  ] = await Promise.all([
    locals.supabase
      .from("motorcycles")
      .select("*")
      .eq("owner_id", user.id)
      .eq("is_active", true),
    locals.supabase.from("fuel_records").select("*").eq("owner_id", user.id),
    locals.supabase
      .from("reminders")
      .select("*")
      .eq("owner_id", user.id)
      .eq("is_active", true),
    locals.supabase
      .from("tire_records")
      .select("*")
      .eq("owner_id", user.id)
      .eq("is_active", true),
    locals.supabase
      .from("motorcycle_documents")
      .select("*")
      .eq("owner_id", user.id),
  ]);

  const summary = dashboardSummary((fuel ?? []) as never);
  const activeMotorcycle = motorcycles?.[0] as
    Record<string, unknown> | undefined;
  const currentOdometer = Number(activeMotorcycle?.current_odometer_km ?? 0);
  const documentRows = (documents ?? []) as Array<Record<string, unknown>>;
  const expiringDocuments = documentRows.filter(
    (doc) => doc.valid_until,
  ).length;

  const metrics = [
    {
      label: "Motos ativas",
      value: String(motorcycles?.length ?? 0),
      detail: "Garagem",
    },
    {
      label: "Odômetro atual",
      value: `${currentOdometer} km`,
      detail: String(activeMotorcycle?.name ?? "Sem moto ativa"),
    },
    {
      label: "Consumo médio",
      value: summary.average_consumption_km_l
        ? `${summary.average_consumption_km_l} km/L`
        : "Sem dados",
      detail: "Tanques cheios",
    },
    {
      label: "Gasto combustível",
      // Unlike the cached pricing lookup, this is built per-request, so it can
      // safely read the reader's locale off locals.
      value: formatMoney(locals.locale, summary.fuel_spend_cents),
      detail: "Histórico completo",
    },
  ];

  return {
    metrics,
    motorcycles: motorcycles ?? [],
    alerts: {
      activeReminders: reminders?.length ?? 0,
      activeTires: tires?.length ?? 0,
      expiringDocuments,
    },
  };
}
