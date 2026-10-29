import { describe, expect, it, vi } from "vitest";
import { ensureAccount } from "../../src/lib/server/auth/bootstrap";

describe("ensureAccount", () => {
  it("provisions once per isolate and skips later requests for that user", async () => {
    const db = vi.fn().mockResolvedValue([]);
    const userId = "user-provision-once";

    await ensureAccount(db as never, userId, "rider@example.com");
    await ensureAccount(db as never, userId, "rider@example.com");

    expect(db).toHaveBeenCalledTimes(2);
  });

  it("does not overwrite preferred_locale on conflict with request locale", async () => {
    const source = await import("node:fs").then((fs) =>
      fs.readFileSync("src/lib/server/auth/bootstrap.ts", "utf8"),
    );
    expect(source).not.toMatch(
      /on conflict \(id\) do update set preferred_locale/,
    );
    expect(source).toContain("on conflict (id) do update set email");
  });
});
