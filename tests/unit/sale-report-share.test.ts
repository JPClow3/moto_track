import { describe, expect, it } from "vitest";
import { shareTokenHash } from "../../src/lib/server/domain/sale-report-share";

describe("sale report share tokens", () => {
  it("derives a stable hash from the complete token", async () => {
    const token = "a".repeat(64);

    await expect(shareTokenHash(token)).resolves.toMatch(/^[a-f0-9]{64}$/);
    await expect(shareTokenHash(token)).resolves.toBe(
      await shareTokenHash(token),
    );
  });

  it("does not treat a common prefix as the same credential", async () => {
    const prefix = "a".repeat(12);

    await expect(
      shareTokenHash(`${prefix}${"b".repeat(52)}`),
    ).resolves.not.toBe(await shareTokenHash(`${prefix}${"c".repeat(52)}`));
  });
});
