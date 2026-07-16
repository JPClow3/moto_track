export const ACCOUNT_EXPORT_TABLES = [
  "motorcycles",
  "fuel_stations",
  "fuel_grades",
  "fuel_records",
  "fuel_preferences",
  "fuel_review_preferences",
  "maintenance_parts",
  "maintenance_records",
  "maintenance_record_parts",
  "maintenance_plan_items",
  "maintenance_photos",
  "tire_products",
  "tire_records",
  "tire_pressure_records",
  "motorcycle_documents",
  "reminders",
  "annual_fees",
  "insurance_policies",
  "insurance_claims",
  "professional_cost_settings",
  "work_sessions",
  "subscription_profiles",
  "account_data_requests",
  "sale_report_shares",
  "article_comments",
  "article_reactions",
  "client_submissions",
  "object_files",
] as const;

export function isDeletionConfirmation(value: string) {
  return value === "EXCLUIR";
}
