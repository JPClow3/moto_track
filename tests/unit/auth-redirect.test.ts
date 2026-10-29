import { describe, expect, it } from "vitest";
import { safeInternalRedirect } from "../../src/lib/server/auth-redirect";

describe("safeInternalRedirect", () => {
  it("keeps an application-relative path including its query string", () => {
    expect(safeInternalRedirect("/billing/conta?checkout=success")).toBe(
      "/billing/conta?checkout=success",
    );
  });

  it("rejects absolute and protocol-relative redirect targets", () => {
    expect(safeInternalRedirect("https://attacker.example")).toBe("/dashboard");
    expect(safeInternalRedirect("//attacker.example")).toBe("/dashboard");
    expect(safeInternalRedirect("/\\attacker.example")).toBe("/dashboard");
  });

  it("rejects targets a browser normalizes onto another origin", () => {
    for (const target of [
      "/\t/attacker.example",
      "/\n/attacker.example",
      "/\r/attacker.example",
      "/\t\\attacker.example",
    ])
      expect(safeInternalRedirect(target)).toBe("/dashboard");
    // A browser resolves the accepted value against the page; it must stay put.
    const accepted = safeInternalRedirect("/garage?tab=docs#top");
    expect(new URL(accepted, "https://moto-track.net").origin).toBe(
      "https://moto-track.net",
    );
  });
});
