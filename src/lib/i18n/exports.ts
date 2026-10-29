import type { Locale } from "$lib/i18n";

const pt = {
  authenticationRequired: "Entre na sua conta para exportar os dados.",
  calendarNotFound: "Calendário não encontrado ou expirado.",
  motorcycleNotFound: "Moto não encontrada.",
  unknownFeature: "Exportação não encontrada.",
  exportTableFailed: "Não foi possível exportar {table}.",
  exportProfileFailed: "Não foi possível exportar os dados da conta.",
  accountFilename: "moto-track-dados.json",
  calendarMileageDescription:
    "Estimativa por quilometragem. Confirme o odômetro no Moto Track.",
  calendarDateDescription:
    "Confira o lembrete e registre a conclusão no Moto Track.",
  fuel: "Abastecimento",
  maintenance: "Manutenção",
  tires: "Pneus",
  feesAndInsurance: "Taxas e seguro",
} as const;

const en: Record<keyof typeof pt, string> = {
  authenticationRequired: "Sign in to export your data.",
  calendarNotFound: "Calendar not found or expired.",
  motorcycleNotFound: "Motorcycle not found.",
  unknownFeature: "Export not found.",
  exportTableFailed: "Could not export {table}.",
  exportProfileFailed: "Could not export account data.",
  accountFilename: "moto-track-data.json",
  calendarMileageDescription:
    "Mileage estimate. Confirm the odometer in Moto Track.",
  calendarDateDescription:
    "Check the reminder and record its completion in Moto Track.",
  fuel: "Fuel",
  maintenance: "Maintenance",
  tires: "Tires",
  feesAndInsurance: "Fees and insurance",
};

export function exportMessages(locale: Locale) {
  return locale === "en" ? en : pt;
}

export function exportText(
  locale: Locale,
  key: keyof typeof pt,
  params: Record<string, string | number>,
) {
  return exportMessages(locale)[key].replace(
    /\{(\w+)\}/g,
    (match, name: string) =>
      Object.hasOwn(params, name) ? String(params[name]) : match,
  );
}
