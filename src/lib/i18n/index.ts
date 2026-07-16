import { ptBR } from "./locales/pt-BR";
// `./locales/en` only imports the `Messages` *type* from here, and type imports
// are erased at compile time — so this pair is not a runtime cycle.
import { en } from "./locales/en";

export const LOCALES = ["pt-BR", "en"] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "pt-BR";
export const LOCALE_COOKIE = "locale";

/** The catalogue shape, widened from pt-BR's literal types so translations
 *  can hold different strings while still being checked key-for-key. */
type Catalogue = typeof ptBR;
export type Messages = {
  [Section in keyof Catalogue]: { [Key in keyof Catalogue[Section]]: string };
};

/** Dotted key paths ("nav.dashboard"), so `t()` can't be handed a bad key. */
export type MessageKey = {
  [
    Section in keyof Messages
  ]: `${Section & string}.${keyof Messages[Section] & string}`;
}[keyof Messages];

export const LOCALE_LABELS: Record<Locale, string> = {
  "pt-BR": "Português (Brasil)",
  en: "English",
};

/**
 * Money stays in BRL in every locale: Stripe charges in BRL, so showing a
 * converted figure would be a number we don't actually bill. Only the
 * *formatting* (separators, symbol placement) follows the locale.
 */
export const CURRENCY = "BRL";

function isLocale(value: unknown): value is Locale {
  return (
    typeof value === "string" && (LOCALES as readonly string[]).includes(value)
  );
}

export function normalizeLocale(value: unknown): Locale | null {
  if (isLocale(value)) return value;
  // Accept a bare language tag ("pt", "en-GB") and resolve it to what we ship.
  if (typeof value !== "string") return null;
  const base = value.toLowerCase().split("-")[0];
  if (base === "pt") return "pt-BR";
  if (base === "en") return "en";
  return null;
}

/**
 * Picks the best locale from an Accept-Language header, honouring q-weights so
 * `en;q=0.8, pt-BR;q=0.9` resolves to pt-BR rather than to whichever came first.
 */
export function localeFromAcceptLanguage(header: string | null): Locale | null {
  if (!header) return null;
  const ranked = header
    .split(",")
    .map((part) => {
      const [tag, ...params] = part.trim().split(";");
      const q = params
        .map((p) => p.trim())
        .find((p) => p.startsWith("q="))
        ?.slice(2);
      const quality = q === undefined ? 1 : Number.parseFloat(q);
      return { tag: tag.trim(), quality: Number.isNaN(quality) ? 0 : quality };
    })
    .filter((entry) => entry.tag && entry.quality > 0)
    .sort((a, b) => b.quality - a.quality);

  for (const { tag } of ranked) {
    const match = normalizeLocale(tag);
    if (match) return match;
  }
  return null;
}

/**
 * Cookie beats header: the header is a guess at the system language, but an
 * explicit switch in the UI is the user telling us they want something else.
 */
export function resolveLocale(
  cookieValue: string | undefined,
  acceptLanguage: string | null,
): Locale {
  return (
    normalizeLocale(cookieValue) ??
    localeFromAcceptLanguage(acceptLanguage) ??
    DEFAULT_LOCALE
  );
}

// Loaded eagerly rather than dynamically imported — the whole catalogue is a
// few KB, and an async boundary here would make `t()` unusable inside SSR loads.
const catalogues: Record<Locale, Messages> = {
  // Cast: ptBR is `as const`, so its literals are narrower than Messages.
  "pt-BR": ptBR as unknown as Messages,
  en,
};

function lookup(locale: Locale, key: MessageKey): string | undefined {
  const [section, entry] = key.split(".") as [keyof Messages, string];
  const bucket = catalogues[locale]?.[section] as
    Record<string, string> | undefined;
  return bucket?.[entry];
}

/**
 * Resolves a key, falling back to pt-BR and finally to the key itself so a
 * gap in a catalogue degrades to readable text instead of a blank element.
 *
 * `params` fills `{name}` placeholders.
 */
export function translate(
  locale: Locale,
  key: MessageKey,
  params?: Record<string, string | number>,
): string {
  const template = lookup(locale, key) ?? lookup(DEFAULT_LOCALE, key) ?? key;
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in params ? String(params[name]) : match,
  );
}

export type Translator = (
  key: MessageKey,
  params?: Record<string, string | number>,
) => string;

export function createTranslator(locale: Locale): Translator {
  return (key, params) => translate(locale, key, params);
}

/* ── Locale-aware formatters ────────────────────────────────────────────────
   These replace the `new Intl.NumberFormat('pt-BR', …)` calls that were
   scattered across pages. Currency is pinned to BRL on purpose — see CURRENCY. */

export function formatMoney(
  locale: Locale,
  cents: number,
  currency = CURRENCY,
) {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(cents / 100);
}

/** Fuel is priced per-litre to three decimals, so it needs its own format. */
export function formatPreciseMoney(
  locale: Locale,
  millicents: number,
  currency = CURRENCY,
) {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: currency.toUpperCase(),
    minimumFractionDigits: 3,
  }).format(millicents / 100000);
}

export function formatNumber(
  locale: Locale,
  value: number,
  options?: Intl.NumberFormatOptions,
) {
  return new Intl.NumberFormat(locale, options).format(value);
}

export function formatDistance(locale: Locale, km: number) {
  return `${formatNumber(locale, km)} km`;
}

export function formatDate(
  locale: Locale,
  value: string | number | Date,
  options: Intl.DateTimeFormatOptions = {
    day: "2-digit",
    month: "short",
    year: "numeric",
  },
) {
  return new Intl.DateTimeFormat(locale, options).format(new Date(value));
}
