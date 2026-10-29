import { describe, expect, it } from "vitest";
import { privateDownloadHeaders } from "../../src/lib/server/r2/files";

describe("private file downloads", () => {
  it("forces uploaded content to download instead of rendering under the app origin", () => {
    const headers = privateDownloadHeaders("invoice.svg", "image/svg+xml");

    expect(headers.get("content-disposition")).toContain("attachment");
    expect(headers.get("x-content-type-options")).toBe("nosniff");
    expect(headers.get("cache-control")).toBe("private, no-store");
  });

  it("builds headers for filenames outside Latin-1", () => {
    for (const name of [
      "Screenshot 2026-10-28 at 10.00.00 AM.png",
      "doc–final.pdf",
      "foto 🏍.jpg",
    ]) {
      const headers = privateDownloadHeaders(name, "image/png");
      const value = headers.get("content-disposition") ?? "";
      expect(value).toContain(`filename*=UTF-8''${encodeURIComponent(name)}`);
      expect(value).toMatch(/^attachment; filename="[\x20-\x7e]+";/);
    }
  });

  it("keeps an accented name readable in the ASCII fallback", () => {
    const value =
      privateDownloadHeaders('Licença "São Paulo".pdf', "application/pdf").get(
        "content-disposition",
      ) ?? "";
    expect(value).toContain('filename="Licenca _Sao Paulo_.pdf"');
  });
});
