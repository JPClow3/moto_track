import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// These migrations live in db/migrations/ now (applied to Neon via
// `npm run db:push`), not supabase/migrations/ — the old Supabase project
// and its CLI-driven migration flow are gone.
const initialSchema = readFileSync(
  new URL(
    "../../db/migrations/20260715001617_initial_schema.sql",
    import.meta.url,
  ),
  "utf8",
);
const saleReportHardening = readFileSync(
  new URL(
    "../../db/migrations/20260715002258_harden_sale_report_shares.sql",
    import.meta.url,
  ),
  "utf8",
);
const securityHardening = readFileSync(
  new URL(
    "../../db/migrations/20260715002909_secure_exposed_schema.sql",
    import.meta.url,
  ),
  "utf8",
);
const blogSeed = readFileSync(
  new URL(
    "../../db/migrations/20260716090000_seed_blog_articles.sql",
    import.meta.url,
  ),
  "utf8",
);

// `--` comments mention things like the $md$ delimiter and dropped RLS
// syntax in prose (documenting what used to be here for Neon migration
// readers); strip them the way Postgres does before asserting on actual
// statements, or these checks trip on the prose itself.
function stripLineComments(sql: string) {
  return sql
    .split("\n")
    .filter((line) => !line.trimStart().startsWith("--"))
    .join("\n");
}

const blogSeedStatements = stripLineComments(blogSeed);
const initialSchemaCode = stripLineComments(initialSchema);
const saleReportHardeningCode = stripLineComments(saleReportHardening);
const securityHardeningCode = stripLineComments(securityHardening);

describe("initial Neon schema", () => {
  // Authorization on Neon is app-layer only (every query filters by
  // owner_id) — there is no auth.uid() and no RLS safety net. These
  // migrations must never reintroduce RLS/policies, or they'd error against
  // Neon (no anon/authenticated roles) and give a false sense of DB-level
  // enforcement that the app layer isn't actually backed by.
  it("does not enable row level security or define policies", () => {
    expect(initialSchemaCode).not.toContain("row level security");
    expect(initialSchemaCode).not.toContain("create policy");
  });

  it('owner-scoped tables reference neon_auth."user" with cascade delete', () => {
    expect(initialSchemaCode).toContain(
      'references neon_auth."user"(id) on delete cascade',
    );
    expect(initialSchemaCode).not.toContain("auth.users");
  });

  it("keeps set_updated_at() and its per-table triggers", () => {
    expect(initialSchemaCode).toContain(
      "create or replace function public.set_updated_at()",
    );
    expect(initialSchemaCode).toContain("public.set_updated_at()");
  });
});

describe("sale report share hardening", () => {
  it("does not recreate the token-hash constraint already supplied by the initial schema", () => {
    expect(saleReportHardeningCode).toContain(
      "if not exists (select 1 from pg_constraint",
    );
  });

  it("does not reintroduce RLS policies (ownership is enforced in the app query layer)", () => {
    expect(saleReportHardeningCode).not.toContain("create policy");
    expect(saleReportHardeningCode).not.toContain("drop policy");
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
  it("does not reintroduce RLS or authenticated-role grants (no RLS on Neon)", () => {
    expect(securityHardeningCode).not.toContain("enable row level security");
    expect(securityHardeningCode).not.toContain("create policy");
    expect(securityHardeningCode).not.toContain("to anon");
    expect(securityHardeningCode).not.toContain("to authenticated");
  });

  it("keeps the search_path pin on set_updated_at()", () => {
    expect(securityHardeningCode).toContain(
      "alter function public.set_updated_at() set search_path = public;",
    );
  });

  it("does not reference the dropped handle_new_user() auth trigger function as executable SQL", () => {
    expect(securityHardeningCode).not.toContain("handle_new_user()");
  });
});
