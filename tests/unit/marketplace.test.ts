import { describe, expect, it, vi } from "vitest";
import {
  isSafeMercadoLivreUrl,
  marketplaceSearchUrl,
  normalizeMarketplaceQuery,
  searchMarketplace,
} from "$server/domain/marketplace";

const auth = { accessToken: "test-access-token" };

describe("normalizeMarketplaceQuery", () => {
  it("trims, collapses whitespace, and caps long input", () => {
    const query = normalizeMarketplaceQuery(
      `  filtro   ${"de ".repeat(80)}óleo  `,
    );
    expect(query.length).toBe(120);
    expect(query.startsWith("filtro de de")).toBe(true);
  });

  it("rejects short and non-string input", () => {
    expect(() => normalizeMarketplaceQuery("ab")).toThrowError(
      "Informe ao menos três caracteres",
    );
    expect(() => normalizeMarketplaceQuery(null)).toThrowError(
      "Informe ao menos três caracteres",
    );
  });
});

describe("marketplace URL policy", () => {
  it("only allows HTTPS Mercado Livre hosts", () => {
    expect(
      isSafeMercadoLivreUrl("https://produto.mercadolivre.com.br/item"),
    ).toBe(true);
    expect(isSafeMercadoLivreUrl("https://mercadolivre.com.br/item")).toBe(
      true,
    );
    expect(
      isSafeMercadoLivreUrl("http://produto.mercadolivre.com.br/item"),
    ).toBe(false);
    expect(
      isSafeMercadoLivreUrl("https://mercadolivre.com.br.evil.test/item"),
    ).toBe(false);
    expect(isSafeMercadoLivreUrl("javascript:alert(1)")).toBe(false);
  });

  it("builds an encoded safe direct search link", () => {
    const url = marketplaceSearchUrl("filtro de óleo");
    expect(url.startsWith("https://lista.mercadolivre.com.br/")).toBe(true);
    expect(new URL(url).searchParams.get("q")).toBe("filtro de óleo");
  });
});

describe("searchMarketplace", () => {
  it("requires an authenticated API token before making a request", async () => {
    const fetchImpl = vi.fn<typeof fetch>();
    await expect(
      searchMarketplace("filtro de óleo", fetchImpl),
    ).rejects.toMatchObject({
      code: "credentials-required",
    });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("maps, filters unsafe records, and sorts public offers by price", async () => {
    const offers = await searchMarketplace(
      "filtro de óleo",
      async () =>
        new Response(
          JSON.stringify({
            results: [
              {
                id: "b",
                title: "Mais caro",
                price: 90,
                currency_id: "BRL",
                permalink: "https://produto.mercadolivre.com.br/MLB-b",
                condition: "new",
              },
              {
                id: "a",
                title: "Mais barato",
                price: 40.5,
                currency_id: "BRL",
                permalink: "https://www.mercadolivre.com.br/MLB-a",
                condition: "new",
              },
              {
                id: "unsafe",
                title: "Não deve virar link externo",
                price: 1,
                permalink: "https://example.test/unsafe",
              },
              {
                id: "broken",
                title: "Sem preço",
                permalink: "https://produto.mercadolivre.com.br/broken",
              },
              {
                id: "null-price",
                title: "Preço nulo",
                price: null,
                permalink: "https://produto.mercadolivre.com.br/null-price",
              },
              {
                id: "empty-price",
                title: "Preço vazio",
                price: "",
                permalink: "https://produto.mercadolivre.com.br/empty-price",
              },
              {
                id: "text-price",
                title: "Preço textual",
                price: "não informado",
                permalink: "https://produto.mercadolivre.com.br/text-price",
              },
              {
                id: "zero-price",
                title: "Preço zero",
                price: 0,
                permalink: "https://produto.mercadolivre.com.br/zero-price",
              },
            ],
          }),
        ),
      auth,
    );
    expect(offers.map((offer) => offer.priceCents)).toEqual([4050, 9000]);
    expect(offers[0].condition).toBe("new");
  });

  it("sends the bearer token, caps the result count, and handles empty results", async () => {
    let seenUrl = "";
    let seenInit: RequestInit | undefined;
    const results = Array.from({ length: 12 }, (_, index) => ({
      id: String(index),
      title: `Oferta ${index}`,
      price: index,
      permalink: `https://produto.mercadolivre.com.br/MLB-${index}`,
    }));
    const offers = await searchMarketplace(
      "  pastilha   freio ",
      async (url, init) => {
        seenUrl = String(url);
        seenInit = init;
        return new Response(JSON.stringify({ results }));
      },
      auth,
    );
    expect(new URL(seenUrl).searchParams.get("q")).toBe("pastilha freio");
    expect((seenInit?.headers as Record<string, string>).authorization).toBe(
      "Bearer test-access-token",
    );
    expect(offers).toHaveLength(10);
    expect(
      await searchMarketplace(
        "pastilha",
        async () => new Response(JSON.stringify({ results: [] })),
        auth,
      ),
    ).toEqual([]);
  });

  it("reports malformed payloads and upstream status failures", async () => {
    await expect(
      searchMarketplace(
        "pastilha",
        async () => new Response(JSON.stringify({ results: "nope" })),
        auth,
      ),
    ).rejects.toMatchObject({ code: "malformed-response" });

    await expect(
      searchMarketplace(
        "pastilha",
        async () => new Response("", { status: 429 }),
        auth,
      ),
    ).rejects.toMatchObject({ code: "rate-limited" });

    await expect(
      searchMarketplace(
        "pastilha",
        async () => new Response("", { status: 403 }),
        auth,
      ),
    ).rejects.toMatchObject({ code: "credentials-required" });

    await expect(
      searchMarketplace(
        "pastilha",
        async () => new Response("", { status: 503 }),
        auth,
      ),
    ).rejects.toMatchObject({ code: "upstream-unavailable" });
  });

  it("converts invalid JSON into a controlled error", async () => {
    await expect(
      searchMarketplace("pastilha", async () => new Response("not json"), auth),
    ).rejects.toMatchObject({ code: "malformed-response" });
  });

  it("aborts a slow request at the configured timeout", async () => {
    vi.useFakeTimers();
    try {
      const pendingFetch = async (
        _url: RequestInfo | URL,
        init?: RequestInit,
      ): Promise<Response> =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () =>
            reject(new DOMException("Aborted", "AbortError")),
          );
        });
      const result = searchMarketplace("pastilha", pendingFetch, {
        ...auth,
        timeoutMs: 25,
      });
      const assertion = expect(result).rejects.toMatchObject({
        code: "timeout",
      });
      await vi.advanceTimersByTimeAsync(25);
      await assertion;
    } finally {
      vi.useRealTimers();
    }
  });
});
