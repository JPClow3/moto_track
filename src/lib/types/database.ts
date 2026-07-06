export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: Record<
      string,
      {
        Row: Record<string, unknown>;
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
        Relationships: [];
      }
    >;
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      billing_plan: "free" | "pro";
      billing_interval: "monthly" | "yearly";
      reminder_trigger_type: "by_km" | "by_date" | "by_interval";
      severity_level: "critical" | "warning" | "success" | "info";
    };
    CompositeTypes: Record<string, never>;
  };
};
