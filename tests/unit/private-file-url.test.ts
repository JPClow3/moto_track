import { describe, expect, it } from "vitest";
import { privateFileUrl } from "../../src/lib/utils/private-file-url";

describe("private file URLs", () => {
  it("preserves R2 key segments while encoding unsafe filename characters", () => {
    expect(privateFileUrl("owner-id/documents/a receipt #1.pdf")).toBe(
      "/files/owner-id/documents/a%20receipt%20%231.pdf",
    );
  });

  it("does not turn a missing object key into a catch-all files URL", () => {
    expect(privateFileUrl(null)).toBeNull();
  });
});
