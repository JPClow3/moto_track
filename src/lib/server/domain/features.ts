import { z } from "zod";
import type { PublicTableName } from "$lib/types/database";

export type FieldKind =
  | "text"
  | "textarea"
  | "number"
  | "date"
  | "datetime"
  | "money"
  | "select"
  | "boolean"
  | "file";

export type FeatureField = {
  key: string;
  label: string;
  kind: FieldKind;
  required?: boolean;
  options?: Array<{ value: string; label: string }>;
  source?: "motorcycles";
  help?: string;
};

export type FeatureConfig = {
  slug: string;
  title: string;
  subtitle: string;
  table: PublicTableName;
  ownerScoped: boolean;
  orderBy: string;
  icon: string;
  fields: FeatureField[];
  listColumns: string[];
};

const money = (key: string, label: string): FeatureField => ({
  key,
  label,
  kind: "money",
});
const date = (key: string, label: string, required = true): FeatureField => ({
  key,
  label,
  kind: "date",
  required,
});
const text = (key: string, label: string, required = false): FeatureField => ({
  key,
  label,
  kind: "text",
  required,
});
const number = (
  key: string,
  label: string,
  required = false,
): FeatureField => ({ key, label, kind: "number", required });
const bool = (key: string, label: string): FeatureField => ({
  key,
  label,
  kind: "boolean",
});
const motorcycle = (required = true): FeatureField => ({
  key: "motorcycle_id",
  label: "Motocicleta",
  kind: "select",
  source: "motorcycles",
  required,
});

export const featureConfigs: Record<string, FeatureConfig> = {
  garage: {
    slug: "garage",
    title: "Garagem",
    subtitle:
      "Perfis de moto, fichas técnicas, odômetro, exclusão suave e setup por template.",
    table: "motorcycles",
    ownerScoped: true,
    orderBy: "name",
    icon: "Bike",
    fields: [
      text("name", "Nome", true),
      text("brand", "Marca", true),
      text("model", "Modelo", true),
      number("year", "Ano", true),
      text("license_plate", "Placa"),
      number("current_odometer_km", "Odômetro atual"),
      number("odometer_override_km", "Correção manual"),
      money("purchase_price_cents", "Valor de compra"),
      date("purchase_date", "Data de compra", false),
      text("riding_profile", "Perfil de uso"),
      { key: "observations", label: "Observações", kind: "textarea" },
    ],
    listColumns: ["name", "brand", "model", "year", "current_odometer_km"],
  },
  fuel: {
    slug: "fuel",
    title: "Combustível",
    subtitle:
      "Histórico de abastecimentos, postos, combustíveis, comprovantes, padrões, repetir e importação.",
    table: "fuel_records",
    ownerScoped: true,
    orderBy: "date.desc",
    icon: "Fuel",
    fields: [
      date("date", "Data"),
      number("odometer_km", "Odômetro", true),
      number("liters", "Litros", true),
      money("total_price_cents", "Total"),
      money("price_per_liter_millicents", "Preço por litro"),
      text("fuel_type", "Combustível"),
      bool("tank_full", "Tanque cheio"),
      text("station_name", "Posto"),
      { key: "notes", label: "Notas", kind: "textarea" },
    ],
    listColumns: [
      "date",
      "odometer_km",
      "liters",
      "total_price_cents",
      "station_name",
    ],
  },
  maintenance: {
    slug: "maintenance",
    title: "Manutenção",
    subtitle:
      "Registros, peças, intervalos, estoque, fotos e lembretes recorrentes.",
    table: "maintenance_records",
    ownerScoped: true,
    orderBy: "date.desc",
    icon: "Wrench",
    fields: [
      motorcycle(),
      date("date", "Data"),
      number("odometer_km", "Odômetro", true),
      text("maintenance_type", "Tipo", true),
      { key: "description", label: "Descrição", kind: "textarea" },
      text("workshop", "Oficina"),
      money("cost_cents", "Custo"),
      number("interval_km", "Intervalo km"),
      number("interval_days", "Intervalo dias"),
    ],
    listColumns: [
      "date",
      "maintenance_type",
      "odometer_km",
      "cost_cents",
      "workshop",
    ],
  },
  tires: {
    slug: "tires",
    title: "Pneus",
    subtitle:
      "Catálogo, histórico de instalação, desgaste, pressão e exportações.",
    table: "tire_records",
    ownerScoped: true,
    orderBy: "installed_at.desc",
    icon: "CircleGauge",
    fields: [
      motorcycle(),
      date("installed_at", "Instalado em"),
      text("position", "Posição", true),
      text("brand_model", "Marca/modelo", true),
      number("installed_odometer_km", "Km instalado", true),
      money("cost_cents", "Custo"),
      number("wear_percent", "Desgaste %"),
      number("estimated_change_km", "Troca estimada km"),
      bool("is_active", "Ativo"),
    ],
    listColumns: [
      "installed_at",
      "position",
      "brand_model",
      "wear_percent",
      "is_active",
    ],
  },
  documents: {
    slug: "documents",
    title: "Documentos",
    subtitle:
      "Cofre de documentos com arquivos no R2, validade, lembretes e exportações.",
    table: "motorcycle_documents",
    ownerScoped: true,
    orderBy: "name",
    icon: "FileText",
    fields: [
      motorcycle(),
      text("name", "Nome", true),
      text("document_type", "Tipo", true),
      date("valid_until", "Validade", false),
      number("notify_before_days", "Avisar antes (dias)"),
      { key: "notes", label: "Notas", kind: "textarea" },
      { key: "file_key", label: "Arquivo", kind: "file" },
    ],
    listColumns: ["name", "document_type", "valid_until", "file_key"],
  },
  reminders: {
    slug: "reminders",
    title: "Lembretes",
    subtitle:
      "Lembretes por data, km e intervalo com adiar, concluir, email e push.",
    table: "reminders",
    ownerScoped: true,
    orderBy: "is_active.desc",
    icon: "Bell",
    fields: [
      motorcycle(),
      text("title", "Título", true),
      { key: "description", label: "Descrição", kind: "textarea" },
      text("trigger_type", "Gatilho", true),
      number("trigger_value_km", "Valor km"),
      number("trigger_value_days", "Valor dias"),
      number("reference_km", "Km referência"),
      date("reference_date", "Data referência", false),
      bool("is_active", "Ativo"),
      bool("send_email", "Enviar email"),
      bool("send_push", "Enviar push"),
    ],
    listColumns: [
      "title",
      "trigger_type",
      "is_active",
      "reference_date",
      "reference_km",
    ],
  },
  expenses: {
    slug: "expenses",
    title: "Despesas",
    subtitle:
      "Taxas anuais, seguros, sinistros, lembretes automáticos e exportação CSV.",
    table: "annual_fees",
    ownerScoped: true,
    orderBy: "due_date.desc",
    icon: "ReceiptText",
    fields: [
      motorcycle(),
      text("fee_type", "Tipo", true),
      number("year", "Ano", true),
      date("due_date", "Vencimento"),
      date("paid_date", "Pago em", false),
      money("amount_cents", "Valor"),
      number("notify_before_days", "Avisar antes"),
      { key: "notes", label: "Notas", kind: "textarea" },
    ],
    listColumns: ["fee_type", "year", "due_date", "paid_date", "amount_cents"],
  },
  reports: {
    slug: "reports",
    title: "Relatórios",
    subtitle:
      "Resumos de custo, linha do tempo, CSV e dossiê de venda com link público.",
    table: "sale_report_shares",
    ownerScoped: true,
    orderBy: "created_at.desc",
    icon: "ChartNoAxesCombined",
    fields: [
      text("token_prefix", "Prefixo"),
      date("expires_at", "Expira em"),
      date("revoked_at", "Revogado em", false),
      number("access_count", "Acessos"),
    ],
    listColumns: ["token_prefix", "expires_at", "revoked_at", "access_count"],
  },
  trabalho: {
    slug: "trabalho",
    title: "Trabalho",
    subtitle:
      "Turnos profissionais, custos diários, faturamento, distância e lucratividade.",
    table: "work_sessions",
    ownerScoped: true,
    orderBy: "work_date.desc",
    icon: "BriefcaseBusiness",
    fields: [
      motorcycle(),
      date("work_date", "Data"),
      text("platform_source", "Plataforma"),
      text("payment_method", "Pagamento"),
      number("odometer_start_km", "Km inicial", true),
      number("odometer_end_km", "Km final", true),
      money("gross_income_cents", "Faturamento"),
      money("tips_cents", "Gorjetas"),
      money("fuel_spent_cents", "Combustível"),
      number("deliveries_count", "Entregas"),
      { key: "notes", label: "Notas", kind: "textarea" },
    ],
    listColumns: [
      "work_date",
      "platform_source",
      "gross_income_cents",
      "odometer_start_km",
      "odometer_end_km",
    ],
  },
};

export function getFeature(slug: string) {
  const feature = featureConfigs[slug];
  if (!feature) {
    throw new Error(`Unknown feature: ${slug}`);
  }
  return feature;
}

export function schemaForFeature(feature: FeatureConfig) {
  const shape: Record<string, z.ZodTypeAny> = {};
  for (const field of feature.fields) {
    let validator: z.ZodTypeAny;
    if (field.kind === "number" || field.kind === "money") {
      validator = z.coerce.number().finite();
    } else if (field.kind === "boolean") {
      validator = z.coerce.boolean().default(false);
    } else {
      validator = z.string().trim();
    }
    shape[field.key] = field.required
      ? validator
      : validator.optional().or(z.literal(""));
  }
  return z.object(shape);
}
