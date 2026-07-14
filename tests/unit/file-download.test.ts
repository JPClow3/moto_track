import { describe, expect, it } from "vitest";
import { privateDownloadHeaders } from "../../src/lib/server/r2/files";

describe("private file downloads", () => {
  it("forces uploaded content to download instead of rendering under the app origin", () => {
    const headers = privateDownloadHeaders("invoice.svg", "image/svg+xml");

    expect(headers.get("content-disposition")).toContain("attachment");
    expect(headers.get("x-content-type-options")).toBe("nosniff");
  });
});
