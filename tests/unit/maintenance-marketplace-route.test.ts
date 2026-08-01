import { describe, expect, it } from "vitest";
import { actions } from "../../src/routes/(app)/maintenance/+page.server";

function actionRequest(query: string) {
  return new Request("http://localhost/maintenance?/searchMarketplace", {
    method: "POST",
    body: new URLSearchParams({ query }),
  });
}

describe("maintenance marketplace action", () => {
  it("returns a safe direct search fallback without claiming live prices", async () => {
    const result = await actions.searchMarketplace({
      request: actionRequest("filtro de óleo"),
    } as never);

    expect(result).toMatchObject({
      ok: true,
      marketplace: {
        query: "filtro de óleo",
        offers: [],
        mode: "external-search",
      },
    });
    expect(result.marketplace?.fallbackUrl).toMatch(
      /^https:\/\/lista\.mercadolivre\.com\.br\//,
    );
    expect(result.marketplace?.error).toBeUndefined();
  });

  it("returns an inline validation state for short queries", async () => {
    const result = await actions.searchMarketplace({
      request: actionRequest("ab"),
    } as never);

    expect(result).toMatchObject({
      ok: false,
      marketplace: { query: "ab", offers: [], error: "invalid-query" },
    });
    expect(result.marketplace?.fallbackUrl).toBeUndefined();
  });
});
