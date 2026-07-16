export type MarketplaceOffer = {
  id: string;
  title: string;
  priceCents: number;
  currency: string;
  permalink: string;
  condition: string;
};

type MercadoLivreResponse = {
  results?: Array<{
    id?: string;
    title?: string;
    price?: number;
    currency_id?: string;
    permalink?: string;
    condition?: string;
  }>;
};

export async function searchMarketplace(
  query: string,
  fetchImpl: typeof fetch = fetch,
) {
  const normalized = query.trim().slice(0, 120);
  if (normalized.length < 3)
    throw new Error("Informe ao menos três caracteres para buscar uma peça.");
  const response = await fetchImpl(
    `https://api.mercadolibre.com/sites/MLB/search?q=${encodeURIComponent(normalized)}&limit=10`,
    { headers: { accept: "application/json" } },
  );
  if (!response.ok)
    throw new Error("Não foi possível consultar ofertas agora.");
  const data = (await response.json()) as MercadoLivreResponse;
  const offers: MarketplaceOffer[] = (data.results ?? [])
    .filter(
      (item) =>
        item.id && item.title && item.permalink && Number.isFinite(item.price),
    )
    .map((item) => ({
      id: item.id!,
      title: item.title!,
      priceCents: Math.round(Number(item.price) * 100),
      currency: item.currency_id ?? "BRL",
      permalink: item.permalink!,
      condition: item.condition ?? "unknown",
    }));
  return offers.sort((a, b) => a.priceCents - b.priceCents);
}
