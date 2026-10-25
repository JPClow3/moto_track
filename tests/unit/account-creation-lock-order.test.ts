import { describe, expect, it } from "vitest";
import { actions as reminderActions } from "../../src/routes/(app)/reminders/+page.server";
import { actions as accessActions } from "../../src/routes/(app)/garage/access/+page.server";
import { actions as invitationActions } from "../../src/routes/(app)/garage/invite/[token]/+page.server";
import { actions as garageActions } from "../../src/routes/(app)/garage/+page.server";

function database() {
  const queries: Array<{ query: string; values: unknown[] }> = [];
  const query = async (strings: TemplateStringsArray, ...values: unknown[]) => {
    const sql = strings.join("?");
    queries.push({ query: sql, values });
    if (sql.includes('select email, "emailVerified"'))
      return [{ email: "member@example.invalid", emailVerified: true }];
    if (sql.includes('select id from neon_auth."user"'))
      return [{ id: values[0] }];
    if (sql.includes("from garage_invitations"))
      return [
        {
          id: "invitation",
          owner_id: "owner",
          invited_email: "member@example.invalid",
          role: "workshop",
        },
      ];
    if (sql.includes("select count(*)")) return [{ count: 0, total: 0 }];
    if (sql.includes("insert into garage_memberships"))
      return [{ id: "membership" }];
    return [];
  };
  const db = Object.assign(query, {
    begin: (callback: (tx: typeof query) => Promise<unknown>) =>
      callback(query),
  });
  return { db, queries };
}

function event(db: unknown, member = false) {
  return {
    locals: {
      db,
      locale: "pt-BR",
      user: {
        id: member ? "member" : "owner",
        email: member ? "member@example.invalid" : "owner@example.invalid",
      },
    },
    params: { token: "a".repeat(64) },
    platform: { env: { PUBLIC_SITE_URL: "https://app.test" } },
    request: new Request("https://app.test/garage/access", {
      method: "POST",
      body: new URLSearchParams({
        email: "member@example.invalid",
        role: "workshop",
      }),
    }),
  };
}

describe("account creation locks against deletion cascades", () => {
  it.each([
    ["calendar", reminderActions.createCalendar],
    ["invitation", accessActions.invite],
  ] as const)(
    "locks the owner before the profile for %s creation",
    async (_, action) => {
      const fixture = database();
      const result = await action(event(fixture.db) as never);
      expect(result).not.toHaveProperty("status");
      const owner = fixture.queries.findIndex(({ query }) =>
        query.includes("for no key update"),
      );
      const profile = fixture.queries.findIndex(({ query }) =>
        query.includes("from profiles"),
      );
      expect(owner).toBeGreaterThanOrEqual(0);
      expect(fixture.queries[owner].values).toEqual(["owner"]);
      expect(profile).toBeGreaterThan(owner);
      expect(fixture.queries.slice(profile + 1)).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            query: expect.stringContaining("insert into"),
          }),
        ]),
      );
    },
  );

  it("locks the verified recipient before the owner and preserves acceptance redirect", async () => {
    const fixture = database();
    await expect(
      invitationActions.accept(event(fixture.db, true) as never),
    ).rejects.toMatchObject({
      status: 303,
      location: "/garage/shared/membership",
    });
    const actor = fixture.queries.findIndex(({ query }) =>
      query.includes("for key share"),
    );
    const owner = fixture.queries.findIndex(({ query }) =>
      query.includes("for no key update"),
    );
    const profile = fixture.queries.findIndex(({ query }) =>
      query.includes("from profiles"),
    );
    expect(actor).toBeGreaterThanOrEqual(0);
    expect(fixture.queries[actor].values).toEqual(["member"]);
    expect(owner).toBeGreaterThan(actor);
    expect(fixture.queries[owner].values).toEqual(["owner"]);
    expect(profile).toBeGreaterThan(owner);
    expect(fixture.queries.at(-1)?.query).toContain("accepted_at = now()");
  });
});

describe("service-start saves", () => {
  it("lock the owner before the in-service trigger touches plans and reminders", async () => {
    const queries: Array<{ query: string; values: unknown[]; tx: boolean }> =
      [];
    let inTransaction = false;
    const query = async (
      strings: TemplateStringsArray,
      ...values: unknown[]
    ) => {
      const sql = strings.join("?");
      queries.push({ query: sql, values, tx: inTransaction });
      if (sql.includes('select id from neon_auth."user"'))
        return [{ id: values[0] }];
      if (sql.includes("update motorcycles")) return [{ id: "bike" }];
      return [];
    };
    const db = Object.assign(query, {
      begin: async (callback: (tx: typeof query) => Promise<unknown>) => {
        inTransaction = true;
        try {
          return await callback(query);
        } finally {
          inTransaction = false;
        }
      },
    });
    const result = await garageActions.saveServiceStart({
      locals: { db, locale: "pt-BR", user: { id: "owner" } },
      request: new Request("https://app.test/garage", {
        method: "POST",
        body: new URLSearchParams({
          motorcycle_id: "00000000-0000-4000-8000-000000000001",
          in_service_date: "2026-01-01",
        }),
      }),
    } as never);
    expect(result).toEqual({ ok: true });
    const owner = queries.findIndex(({ query }) =>
      query.includes("for no key update"),
    );
    const update = queries.findIndex(({ query }) =>
      query.includes("update motorcycles"),
    );
    expect(owner).toBeGreaterThanOrEqual(0);
    expect(queries[owner]).toMatchObject({ values: ["owner"], tx: true });
    expect(update).toBeGreaterThan(owner);
    expect(queries[update].tx).toBe(true);
  });
});
