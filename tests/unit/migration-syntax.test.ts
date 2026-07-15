import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const initialSchema = readFileSync(
  new URL(
    "../../supabase/migrations/202607060001_initial_schema.sql",
    import.meta.url,
  ),
  "utf8",
);
const saleReportHardening = readFileSync(
  new URL(
    "../../supabase/migrations/20260714193000_harden_sale_report_shares.sql",
    import.meta.url,
  ),
  "utf8",
);
const securityHardening = readFileSync(
  new URL(
    "../../supabase/migrations/20260715002523_secure_exposed_schema.sql",
    import.meta.url,
  ),
  "utf8",
);

describe("initial Supabase schema", () => {
  it("uses an identifier formatter for dynamically-created RLS policies", () => {
    expect(initialSchema).not.toContain("create policy %L");
    expect(initialSchema).toContain("create policy %I");
  });
});

describe("sale report share hardening", () => {
  it("does not recreate the token-hash constraint already supplied by the initial schema", () => {
    expect(saleReportHardening).toContain(
      "if not exists (select 1 from pg_constraint",
    );
  });

  it("drops the exact policy names created by the initial schema", () => {
    expect(saleReportHardening).toContain(
      'drop policy if exists "sale report shares owner insert"',
    );
    expect(saleReportHardening).toContain(
      'drop policy if exists "sale report shares owner update"',
    );
  });
});

describe("exposed-schema hardening", () => {
  it("enables RLS on internal tables and preserves authenticated template reads", () => {
    expect(securityHardening).toContain(
      "alter table public.billing_events enable row level security;",
    );
    expect(securityHardening).toContain(
      'create policy "motorcycle templates authenticated read"',
    );
    expect(securityHardening).toContain(
      "for select to authenticated using (true);",
    );
  });

  it("locks down the auth trigger function and fixed function search paths", () => {
    expect(securityHardening).toContain(
      "revoke all on function public.handle_new_user() from public;",
    );
    expect(securityHardening).toContain(
      "revoke all on function public.handle_new_user() from anon, authenticated;",
    );
    expect(securityHardening).toContain(
      "alter function public.set_updated_at() set search_path = public;",
    );
  });
});
