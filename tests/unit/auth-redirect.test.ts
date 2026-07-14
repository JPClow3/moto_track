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
});
