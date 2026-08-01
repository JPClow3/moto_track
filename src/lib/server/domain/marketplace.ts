export type MarketplaceOfferCondition = "new" | "used" | "unknown";

export type MarketplaceOffer = {
  id: string;
  title: string;
  priceCents: number;
  currency: string;
  permalink: string;
  condition: MarketplaceOfferCondition;
};

export type MarketplaceErrorCode =
  | "invalid-query"
  | "credentials-required"
  | "rate-limited"
  | "timeout"
  | "malformed-response"
  | "upstream-unavailable";

export class MarketplaceError extends Error {
  readonly code: MarketplaceErrorCode;

  constructor(code: MarketplaceErrorCode, message: string) {
    super(message);
    this.name = "MarketplaceError";
    this.code = code;
  }
}

export const MARKETPLACE_QUERY_MAX_LENGTH = 120;
export const MARKETPLACE_RESULT_LIMIT = 10;
export const MARKETPLACE_TIMEOUT_MS = 5_000;

type MercadoLivreResponse = {
  results?: unknown;
};

type MercadoLivreItem = {
  id?: unknown;
  title?: unknown;
  price?: unknown;
  currency_id?: unknown;
  permalink?: unknown;
  condition?: unknown;
};

export type MarketplaceSearchOptions = {
  accessToken?: string;
  timeoutMs?: number;
};

const MERCADO_LIVRE_HOST = "mercadolivre.com.br";
const MAX_TITLE_LENGTH = 240;
const MAX_ID_LENGTH = 80;
const MAX_PRICE_CENTS = 100_000_000_00;

function normalizedText(value: unknown, maxLength: number) {
  return typeof value === "string"
    ? value.trim().replace(/\s+/g, " ").slice(0, maxLength)
    : "";
}

/**
 * Normalize user input once at the server boundary. We cap rather than reject
 * long input so pasted part descriptions remain useful while never reaching
 * the upstream API unbounded.
 */
export function normalizeMarketplaceQuery(query: unknown) {
  const normalized = normalizedText(query, MARKETPLACE_QUERY_MAX_LENGTH);
  if (normalized.length < 3) {
    throw new MarketplaceError(
      "invalid-query",
      "Informe ao menos três caracteres para buscar uma peça.",
    );
  }
  return normalized;
}

/**
 * Only links that stay on Mercado Livre's Brazilian HTTPS host are exposed to
 * the browser. Svelte escapes the value in markup, but validating the origin
 * here also prevents an upstream payload from becoming an unsafe destination.
 */
export function isSafeMercadoLivreUrl(value: unknown): value is string {
  if (typeof value !== "string" || value.length > 2_048) return false;
  try {
    const url = new URL(value);
    const hostname = url.hostname.toLowerCase();
    return (
      url.protocol === "https:" &&
      (hostname === MERCADO_LIVRE_HOST ||
        hostname.endsWith(`.${MERCADO_LIVRE_HOST}`))
    );
  } catch {
    return false;
  }
}

/** Build the no-credential/no-results fallback without trusting user input. */
export function marketplaceSearchUrl(query: unknown) {
  const normalized = normalizeMarketplaceQuery(query);
  const url = new URL(`https://lista.${MERCADO_LIVRE_HOST}/`);
  url.searchParams.set("q", normalized);
  return url.toString();
}

function mapCondition(value: unknown): MarketplaceOfferCondition {
  return value === "new" || value === "used" ? value : "unknown";
}

function mapOffer(value: unknown): MarketplaceOffer | null {
  if (!value || typeof value !== "object") return null;
  const item = value as MercadoLivreItem;
  const id = normalizedText(item.id, MAX_ID_LENGTH);
  const title = normalizedText(item.title, MAX_TITLE_LENGTH);
  const permalink = typeof item.permalink === "string" ? item.permalink : "";
  // Mercado Livre's price field is numeric. Do not coerce null, empty strings,
  // or arbitrary text: Number(null) and Number("") would otherwise become a
  // bogus free offer. Zero-priced listings are not a documented API case and
  // are excluded until the provider contract explicitly supports them.
  const price = item.price;
  if (
    !id ||
    !title ||
    !isSafeMercadoLivreUrl(permalink) ||
    typeof price !== "number" ||
    !Number.isFinite(price) ||
    price <= 0 ||
    price * 100 > MAX_PRICE_CENTS
  ) {
    return null;
  }

  const currency = normalizedText(item.currency_id, 3).toUpperCase();
  return {
    id,
    title,
    priceCents: Math.round(price * 100),
    currency: /^[A-Z]{3}$/.test(currency) ? currency : "BRL",
    permalink,
    condition: mapCondition(item.condition),
  };
}

function errorForStatus(status: number) {
  if (status === 401 || status === 403) {
    return new MarketplaceError(
      "credentials-required",
      "A consulta automática do Mercado Livre não está disponível agora.",
    );
  }
  if (status === 429) {
    return new MarketplaceError(
      "rate-limited",
      "O Mercado Livre limitou novas consultas. Tente novamente em instantes.",
    );
  }
  return new MarketplaceError(
    "upstream-unavailable",
    "Não foi possível consultar ofertas agora.",
  );
}

/**
 * Search Mercado Livre from the server. `fetchImpl` is injectable for unit
 * tests; production callers can provide a request-scoped OAuth access token
 * once the product has a complete Mercado Livre OAuth lifecycle.
 */
export async function searchMarketplace(
  query: unknown,
  fetchImpl: typeof fetch = fetch,
  options: MarketplaceSearchOptions = {},
) {
  const normalized = normalizeMarketplaceQuery(query);
  // Mercado Livre's API requires a short-lived OAuth access token. Keeping
  // this guard in the adapter prevents accidental anonymous calls while
  // retaining an injectable, authenticated contract for a future OAuth flow.
  if (!options.accessToken?.trim()) {
    throw new MarketplaceError(
      "credentials-required",
      "A consulta automática do Mercado Livre não está disponível agora.",
    );
  }
  const timeoutMs = Math.max(
    1,
    Math.min(options.timeoutMs ?? MARKETPLACE_TIMEOUT_MS, 30_000),
  );
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const headers: HeadersInit = { accept: "application/json" };
    if (options.accessToken?.trim()) {
      headers.authorization = `Bearer ${options.accessToken.trim()}`;
    }
    const url = new URL("https://api.mercadolibre.com/sites/MLB/search");
    url.searchParams.set("q", normalized);
    url.searchParams.set("limit", String(MARKETPLACE_RESULT_LIMIT));
    const response = await fetchImpl(url.toString(), {
      headers,
      signal: controller.signal,
    });
    if (!response.ok) throw errorForStatus(response.status);

    let data: MercadoLivreResponse;
    try {
      data = (await response.json()) as MercadoLivreResponse;
    } catch {
      throw new MarketplaceError(
        "malformed-response",
        "A resposta de ofertas veio em um formato inválido.",
      );
    }
    if (!data || typeof data !== "object") {
      throw new MarketplaceError(
        "malformed-response",
        "A resposta de ofertas veio em um formato inválido.",
      );
    }
    if (data.results !== undefined && !Array.isArray(data.results)) {
      throw new MarketplaceError(
        "malformed-response",
        "A resposta de ofertas veio em um formato inválido.",
      );
    }

    return (data.results ?? [])
      .map(mapOffer)
      .filter((offer): offer is MarketplaceOffer => offer !== null)
      .sort((a, b) => a.priceCents - b.priceCents || a.id.localeCompare(b.id))
      .slice(0, MARKETPLACE_RESULT_LIMIT);
  } catch (error) {
    if (error instanceof MarketplaceError) throw error;
    if (controller.signal.aborted) {
      throw new MarketplaceError(
        "timeout",
        "A consulta demorou demais. Tente novamente em instantes.",
      );
    }
    throw new MarketplaceError(
      "upstream-unavailable",
      "Não foi possível consultar ofertas agora.",
    );
  } finally {
    clearTimeout(timer);
  }
}
