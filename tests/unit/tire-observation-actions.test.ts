import { describe, expect, it, vi } from "vitest";
import { actions } from "../../src/routes/(app)/tires/+page.server";

vi.mock("$env/dynamic/private", () => ({ env: {} }));
vi.mock("$env/dynamic/public", () => ({ env: {} }));

const tireId = "00000000-0000-4000-8000-000000000001";
const ownerId = "00000000-0000-4000-8000-000000000002";

function event(db: unknown, wear: string, id = tireId) {
  const form = new FormData();
  form.set("id", id);
  form.set("wear_percent", wear);
  form.set("wear_observed_at", "1970-01-01");
  form.set("wear_odometer_km", "999999");
  return {
    request: new Request("https://example.test/tires?/recordWearObservation", {
      method: "POST",
      body: form,
    }),
    locals: { db, user: { id: ownerId }, locale: "en" },
  } as never;
}

describe("explicit tire wear measurements", () => {
  it("rejects missing, fractional, nonfinite and out-of-range wear before database access", async () => {
    const begin = vi.fn();
    for (const wear of ["", "NaN", "Infinity", "0.5", "-1", "101"]) {
      const response = await actions.recordWearObservation(
        event({ begin }, wear),
      );
      expect(response).toMatchObject({ status: 400 });
    }
    expect(begin).not.toHaveBeenCalled();
  });

  it("records zero percent and ignores client-supplied observation date and mileage", async () => {
    const tx = vi.fn(async (strings: TemplateStringsArray) => {
      const text = strings.join("");
      if (text.includes('from neon_auth."user"')) return [{ id: ownerId }];
      if (text.includes("select r.id from tire_records"))
        return [{ id: tireId }];
      return [];
    });
    const db = {
      begin: async (callback: (transaction: unknown) => unknown) =>
        callback(tx),
    };
    expect(await actions.recordWearObservation(event(db, "0"))).toMatchObject({
      ok: true,
      wearObservationSaved: true,
    });
    const update = tx.mock.calls.find(([strings]) =>
      strings.join("").includes("update tire_records"),
    );
    expect(update?.[0].join("")).toContain(
      "wear_observed_at = clock_timestamp()",
    );
    expect(update?.slice(1)).toEqual([0, tireId, ownerId]);
  });

  it("does not update a tire outside the owner's active motorcycle scope", async () => {
    const tx = vi.fn(async (strings: TemplateStringsArray) =>
      strings.join("").includes('from neon_auth."user"')
        ? [{ id: ownerId }]
        : [],
    );
    const db = {
      begin: async (callback: (transaction: unknown) => unknown) =>
        callback(tx),
    };
    expect(await actions.recordWearObservation(event(db, "50"))).toMatchObject({
      status: 404,
    });
    const lookup = tx.mock.calls.find(([strings]) =>
      strings.join("").includes("select r.id from tire_records"),
    );
    expect(lookup?.[0].join("")).toContain("r.owner_id =");
    expect(lookup?.[0].join("")).toContain("r.is_active = true");
    expect(lookup?.[0].join("")).toContain("m.deleted_at is null");
    expect(
      tx.mock.calls.some(([strings]) =>
        strings.join("").includes("update tire_records"),
      ),
    ).toBe(false);
  });
});
