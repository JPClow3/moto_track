import type { Sql } from "postgres";
import { describe, expect, it, vi } from "vitest";
import {
  actions,
  load,
} from "../../src/routes/(app)/maintenance/workshops/+page.server";

const recordId = "00000000-0000-4000-8000-000000000001";
function request(values: Record<string, string>) {
  return new Request("http://localhost/maintenance/workshops", {
    method: "POST",
    body: new URLSearchParams(values),
  });
}

describe("workshop comparison route", () => {
  it("requires authentication in both reads and writes", async () => {
    const locals = { user: null } as App.Locals;
    await expect(
      load({ locals, url: new URL("http://localhost/maintenance/workshops") }),
    ).rejects.toMatchObject({ status: 401 });
    await expect(
      actions.withdraw({ locals, request: request({ record_id: recordId }) }),
    ).rejects.toMatchObject({ status: 401 });
  });

  it("returns localized consent errors without database access", async () => {
    const db = vi.fn();
    const result = await actions.contribute({
      locals: {
        user: { id: "owner" },
        db,
        locale: "en",
      } as unknown as App.Locals,
      request: request({
        record_id: recordId,
        labor_amount: "30",
        city: "Santos",
        state: "SP",
      }),
    });
    expect(result).toMatchObject({
      status: 400,
      data: {
        message: "Confirm voluntary sharing to continue.",
        values: { laborAmount: "30" },
      },
    });
    expect(db).not.toHaveBeenCalled();
  });

  it("queries only aggregate output for the normalized service and region, and keeps own records owner-scoped", async () => {
    const calls: { text: string; values: unknown[] }[] = [];
    const db = ((strings: TemplateStringsArray, ...values: unknown[]) => {
      const text = strings.join("?");
      calls.push({ text, values });
      return Promise.resolve(
        text.includes("from workshop_benchmark_summary")
          ? [
              {
                workshop_name: "Visible",
                sample_size: 5,
                average_labor_cents: 5000,
              },
              {
                workshop_name: "Private",
                sample_size: 4,
                average_labor_cents: 1000,
              },
            ]
          : [],
      );
    }) as unknown as Sql;
    const result = await load({
      locals: {
        user: { id: "owner" },
        db,
        locale: "pt-BR",
      } as unknown as App.Locals,
      url: new URL(
        "http://localhost/maintenance/workshops?service=Troca+de+%C3%B3leo&city=S%C3%A3o+Paulo&state=sp",
      ),
    });
    expect(result.summaries).toEqual([
      { workshop: "Visible", accounts: 5, averageLaborCents: 5000 },
    ]);
    expect(calls[0].text).toContain("where owner_id = ?");
    expect(calls[0].values).toContain("owner");
    expect(calls[1].text).toContain("where g.owner_id = ?");
    expect(calls[1].values).toContain("owner");
    expect(calls[2].values).toEqual(["troca-de-oleo", "sao-paulo", "SP"]);
    expect(calls[2].text).not.toContain("owner_id");
    expect(result.loadError).toBe(false);
  });

  it("distinguishes a database failure from an insufficient sample", async () => {
    const db = (() =>
      Promise.reject(new Error("database unavailable"))) as unknown as Sql;
    const result = await load({
      locals: { user: { id: "owner" }, db } as unknown as App.Locals,
      url: new URL("http://localhost/maintenance/workshops"),
    });
    expect(result.loadError).toBe(true);
    expect(result.summaries).toEqual([]);
  });

  it("rejects oversized identities rather than comparing a silently truncated name", async () => {
    const db = vi.fn().mockResolvedValue([]) as unknown as Sql;
    const result = await load({
      locals: { user: { id: "owner" }, db } as unknown as App.Locals,
      url: new URL(
        `http://localhost/maintenance/workshops?service=${"s".repeat(121)}&city=Santos&state=SP`,
      ),
    });
    expect(result.validSearch).toBe(false);
    expect(db).toHaveBeenCalledTimes(2);
  });
});
