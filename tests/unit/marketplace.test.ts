import { describe, expect, it } from "vitest";
import { searchMarketplace } from "$server/domain/marketplace";

describe("searchMarketplace", () => {
  it("maps and sorts public marketplace offers by price", async () => {
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
                permalink: "https://example.test/b",
                condition: "new",
              },
              {
                id: "a",
                title: "Mais barato",
                price: 40.5,
                currency_id: "BRL",
                permalink: "https://example.test/a",
                condition: "new",
              },
            ],
          }),
        ),
    );
    expect(offers.map((offer) => offer.priceCents)).toEqual([4050, 9000]);
  });
});
