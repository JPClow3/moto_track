import { describe, expect, it, vi } from "vitest";
import {
  garageRole,
  canWriteGarageRecord,
  requireGarageMembership,
  type GarageRole,
} from "$server/domain/garage-access";
import type { Sql } from "postgres";

describe("shared garage access", () => {
  it("rejects unknown roles and keeps workshop scope limited to maintenance", () => {
    expect(garageRole("admin")).toBeNull();
    expect(garageRole("owner")).toBeNull();
    for (const role of ["viewer", "contributor", "workshop"] as GarageRole[]) {
      expect(canWriteGarageRecord(role, "maintenance")).toBe(role !== "viewer");
      expect(canWriteGarageRecord(role, "fuel")).toBe(role === "contributor");
      for (const feature of [
        "garage",
        "documents",
        "billing",
        "admin",
        "tires",
        "expenses",
      ])
        expect(canWriteGarageRecord(role, feature)).toBe(false);
    }
  });
  it("denies missing or revoked membership and constrains lookup to the signed-in member", async () => {
    const query = vi.fn().mockResolvedValue([]);
    const db = query as unknown as Sql;
    const id = "00000000-0000-4000-8000-000000000001";
    await expect(
      requireGarageMembership(db, "signed-in-member", id),
    ).rejects.toMatchObject({ status: 404 });
    const lookup = query.mock.calls.find((args) =>
      args[0].join("").includes("from garage_memberships"),
    );
    expect(lookup?.slice(1)).toContain("signed-in-member");
    expect(lookup?.[0].join("")).toContain("revoked_at is null");
  });
  it("rejects malformed access identifiers before querying", async () => {
    const db = vi.fn() as unknown as Sql;
    await expect(
      requireGarageMembership(db, "user", "../billing"),
    ).rejects.toMatchObject({ status: 404 });
    expect(db).not.toHaveBeenCalled();
  });
});
