import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
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

describe("free entitlement cap triggers", () => {
  const migration = readFileSync(
    new URL(
      "../../db/migrations/20260723093000_enforce_free_entitlement_caps.sql",
      import.meta.url,
    ),
    "utf8",
  );

  it("adds database triggers that mirror marketed Free limits", () => {
    expect(migration).toContain("owner_has_pro_access");
    expect(migration).toContain("enforce_free_reminder_limit");
    expect(migration).toContain("enforce_free_work_session_limit");
    expect(migration).toContain("enforce_free_upload_limit");
    expect(migration).toContain("enforce_free_active_motorcycle_limit");
  });

  it("does not reintroduce RLS/role grants (no authenticated/service_role on Neon)", () => {
    expect(migration).not.toContain("enable row level security");
    expect(migration).not.toContain("create policy");
    expect(migration).not.toContain("to authenticated");
    expect(migration).not.toContain("to service_role");
  });
});

describe("privileged column lockdown (app-layer, no auth.role() on Neon)", () => {
  // The old Supabase migration used a trigger gated on
  // `auth.role() = 'service_role'` to let only service-role writes change
  // `is_staff`. Neon has no such role — every query, including staff/admin
  // ones, runs through the same app DB connection — so a SQL trigger here
  // couldn't tell "the app" from a trusted operator's console session and
  // would end up blocking the only legitimate way to grant staff access.
  // The invariant is enforced by never adding a write path in app code
  // instead (see the comment on `isStaffUser` in staff.ts); these tests are
  // the regression guard for that choice.
  const staffModule = readFileSync(
    new URL("../../src/lib/server/domain/staff.ts", import.meta.url),
    "utf8",
  );

  it("documents the app-layer invariant instead of a ported auth.role() trigger", () => {
    expect(staffModule).toContain("no user-facing write path");
    expect(staffModule).toContain("Neon has no such role");
  });

  it("never writes is_staff from a user-facing route or domain module", () => {
    const roots = ["src/routes", "src/lib/server/domain"];
    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = join(dir, entry.name);
        if (entry.isDirectory()) {
          walk(full);
          continue;
        }
        if (!/\.(ts|svelte)$/.test(entry.name)) continue;
        const text = readFileSync(full, "utf8");
        if (/is_staff\s*[:=]/.test(text) && !full.endsWith("staff.ts")) {
          offenders.push(full);
        }
      }
    };
    walk(resolve(process.cwd(), roots[0]));
    walk(resolve(process.cwd(), roots[1]));
    expect(offenders).toEqual([]);
  });
});
