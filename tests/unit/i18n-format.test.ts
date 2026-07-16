import { describe, expect, it } from "vitest";
import {
  formatMoney,
  formatPreciseMoney,
  localeFromAcceptLanguage,
  resolveLocale,
  translate,
} from "$lib/i18n";

/**
 * Intl separates the currency symbol from the number with a non-breaking space,
 * and the exact codepoint varies by ICU version. Normalise for assertions.
 */
const plain = (value: string) => value.replace(/\s/g, " ");

describe("money formatting", () => {
  // This assertion moved here from pro-pricing.test.ts when the pre-formatted
  // string was removed from PlanPrice.
  it("formats BRL the Brazilian way for a pt-BR reader", () => {
    expect(plain(formatMoney("pt-BR", 1990))).toBe("R$ 19,90");
    expect(plain(formatMoney("pt-BR", 19900))).toBe("R$ 199,00");
  });

  it("keeps the amount in BRL for an English reader and only changes separators", () => {
    // The point of the currency decision: Stripe charges BRL, so an English
    // reader must still see a BRL figure — never a converted one.
    const formatted = plain(formatMoney("en", 1990));
    expect(formatted).toContain("19.90");
    expect(formatted).toMatch(/R\$/);
  });

  it("renders fuel prices to three decimals", () => {
    expect(plain(formatPreciseMoney("pt-BR", 599_000))).toBe("R$ 5,990");
  });

  it("honours a currency other than the BRL default", () => {
    expect(plain(formatMoney("en", 1990, "usd"))).toBe("$19.90");
  });
});

describe("locale negotiation", () => {
  it("picks the highest q-weight rather than header order", () => {
    expect(localeFromAcceptLanguage("en;q=0.8, pt-BR;q=0.9")).toBe("pt-BR");
    expect(localeFromAcceptLanguage("pt-BR;q=0.7, en;q=0.9")).toBe("en");
  });

  it("resolves a bare or regional tag to a locale we ship", () => {
    expect(localeFromAcceptLanguage("pt")).toBe("pt-BR");
    expect(localeFromAcceptLanguage("en-GB")).toBe("en");
    expect(localeFromAcceptLanguage("pt-PT")).toBe("pt-BR");
  });

  it("ignores languages we do not ship", () => {
    expect(localeFromAcceptLanguage("fr-FR,de;q=0.9")).toBeNull();
  });

  it("lets an explicit choice beat the system language", () => {
    expect(resolveLocale("en", "pt-BR")).toBe("en");
    expect(resolveLocale(undefined, "en-US")).toBe("en");
  });

  it("falls back to pt-BR when nothing matches", () => {
    expect(resolveLocale(undefined, null)).toBe("pt-BR");
    expect(resolveLocale("klingon", "fr")).toBe("pt-BR");
  });
});

describe("translate", () => {
  it("fills placeholders", () => {
    expect(translate("en", "error.code", { status: 500 })).toBe("Error 500");
  });

  it("falls back to pt-BR rather than rendering a blank", () => {
    // Every key exists in both catalogues today; this guards the behaviour for
    // when one inevitably drifts.
    expect(translate("en", "nav.dashboard")).toBe("Dashboard");
    expect(translate("pt-BR", "nav.dashboard")).toBe("Painel");
  });
});
