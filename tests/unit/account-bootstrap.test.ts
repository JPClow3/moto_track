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
});
