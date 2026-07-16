import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const initialSchema = readFileSync(
  new URL(
    "../../supabase/migrations/20260715001617_initial_schema.sql",
    import.meta.url,
  ),
  "utf8",
);
const saleReportHardening = readFileSync(
  new URL(
    "../../supabase/migrations/20260715002258_harden_sale_report_shares.sql",
    import.meta.url,
  ),
  "utf8",
);
const securityHardening = readFileSync(
  new URL(
    "../../supabase/migrations/20260715002909_secure_exposed_schema.sql",
    import.meta.url,
  ),
  "utf8",
);
const blogSeed = readFileSync(
  new URL(
    "../../supabase/migrations/20260716090000_seed_blog_articles.sql",
    import.meta.url,
  ),
  "utf8",
);

// `--` comments mention the $md$ delimiter in prose; strip them the way
// Postgres does before counting, or the parity check reads a false failure.
const blogSeedStatements = blogSeed
  .split("\n")
  .filter((line) => !line.trimStart().startsWith("--"))
  .join("\n");

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

describe("blog article seed", () => {
  const bodies = blogSeedStatements
    .split("$md$")
    .filter((_, index) => index % 2 === 1);

  it("closes every dollar-quoted body", () => {
    // An odd delimiter count means a body ran into the next column and the
    // whole migration fails at apply time, not at review time.
    expect(blogSeedStatements.split("$md$").length - 1).toBe(bodies.length * 2);
    expect(bodies.length).toBeGreaterThanOrEqual(16);
  });

  it("stays re-runnable and does not clobber later admin edits", () => {
    expect(blogSeed).toContain("on conflict (slug) do nothing");
  });

  it("pins published_at so the blog ordering is identical in every environment", () => {
    expect(blogSeedStatements).not.toContain("now()");
    for (const body of bodies) {
      expect(body.trim().startsWith("## ")).toBe(true);
    }
  });

  it("seeds the guides the previous stack shipped", () => {
    for (const slug of [
      "como-calcular-consumo-combustivel-honda-cb-500x",
      "cronograma-manutencao-corrente-yamaha-mt07-xj6-tracer900",
      "guia-troca-oleo-yamaha-fz25-fazer-250",
      "quando-trocar-pastilhas-freio-honda-cb-300f-twister",
      "checklist-seguranca-viajar-moto-brasil",
      "como-ajustar-suspensao-traseira-cargas-diferentes",
      "troca-de-oleo-honda-cg-160",
      "troca-de-oleo-honda-cg-125",
    ]) {
      expect(blogSeed).toContain(`'${slug}'`);
    }
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
