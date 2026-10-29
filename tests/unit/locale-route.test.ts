import { describe, expect, it, vi } from "vitest";
import { POST } from "../../src/routes/locale/+server";

function event(locale: string, redirectTo: string, user?: { id: string }) {
  const statements: string[] = [];
  const db = ((first: unknown) => {
    if (Array.isArray(first))
      statements.push((first as string[]).join("?").replaceAll(/\s+/g, " "));
    return Promise.resolve([]);
  }) as unknown as App.Locals["db"];
  const request = {
    request: new Request("https://app.example/locale", {
      method: "POST",
      body: new URLSearchParams({ locale, redirectTo }),
    }),
    cookies: { set: vi.fn() },
    url: new URL("https://app.example/locale"),
    locals: { user, db },
    statements,
  };
  return request as unknown as Parameters<typeof POST>[0] & {
    statements: string[];
  };
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
  it("stores the notification locale when a signed-in rider switches language", async () => {
    const request = event("en", "/dashboard", { id: "rider-1" });
    await expect(POST(request)).rejects.toMatchObject({
      status: 303,
      location: "/dashboard",
    });
    expect(request.statements.join("\n")).toContain(
      "update profiles set preferred_locale",
    );
  });
  it("leaves notification locale alone for a visitor", async () => {
    const request = event("en", "/");
    await expect(POST(request)).rejects.toMatchObject({ status: 303 });
    expect(request.statements).toEqual([]);
  });
});
