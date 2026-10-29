import { describe, expect, it, vi } from "vitest";
import { POST } from "../../src/routes/locale/+server";

function event(locale: string, redirectTo: string) {
  return {
    request: new Request("https://app.example/locale", {
      method: "POST",
      body: new URLSearchParams({ locale, redirectTo }),
    }),
    cookies: { set: vi.fn() },
    url: new URL("https://app.example/locale"),
  } as unknown as Parameters<typeof POST>[0];
}
describe("locale selection", () => {
  it("stores the explicit English preference and preserves a same-origin return path", async () => {
    const request = event("en-GB", "/precos?source=locale#plans");
    await expect(POST(request)).rejects.toMatchObject({
      status: 303,
      location: "/precos?source=locale#plans",
    });
    expect(request.cookies.set).toHaveBeenCalledWith(
      "locale",
      "en",
      expect.objectContaining({ path: "/", sameSite: "lax", maxAge: 31536000 }),
    );
  });
  it.each([
    "https://elsewhere.example",
    "//elsewhere.example",
    "/\\elsewhere.example",
    "/\\[]",
  ])("rejects an external or malformed redirect %s", async (target) => {
    await expect(POST(event("pt-BR", target))).rejects.toMatchObject({
      status: 303,
      location: "/",
    });
  });
  it("does not set a cookie for unsupported languages", async () => {
    const request = event("fr", "/");
    await expect(POST(request)).rejects.toMatchObject({ status: 400 });
    expect(request.cookies.set).not.toHaveBeenCalled();
  });
});
