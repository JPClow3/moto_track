import { describe, expect, it } from "vitest";
import { legalCopy, privacySections, termsSections } from "$lib/i18n/legal";

const contact = {
  companyName: "Example operator",
  supportEmail: "privacy@example.test",
};

describe("legal content translations", () => {
  it("keeps every published section and paragraph in both languages", () => {
    for (const sections of [termsSections, privacySections]) {
      const portuguese = sections("pt-BR", contact);
      const english = sections("en", contact);
      expect(english.map((section) => section.id)).toEqual(
        portuguese.map((section) => section.id),
      );
      expect(english.map((section) => section.paragraphs.length)).toEqual(
        portuguese.map((section) => section.paragraphs.length),
      );
      for (const section of english) {
        expect(section.title.trim()).not.toBe("");
        expect(
          section.paragraphs.every((paragraph) => paragraph.trim().length > 0),
        ).toBe(true);
      }
    }
  });

  it("preserves the trial, withdrawal, request and residual-copy deadlines", () => {
    const terms = termsSections("en", contact)
      .flatMap((section) => section.paragraphs)
      .join(" ");
    const privacy = privacySections("en", contact)
      .flatMap((section) => section.paragraphs)
      .join(" ");
    expect(terms).toContain("7-day free trial");
    expect(terms).toContain("withdraw within 7 days");
    expect(terms).toContain("Article 49");
    expect(terms).toContain("within 15 days");
    expect(privacy).toContain("within 90 days");
    expect(privacy).toContain("within 15 days");
    expect(privacy).toContain("Article 33");
    expect(legalCopy("en").updated).toBe("Last updated: September 29, 2026");
  });

  it("keeps the actual operator, contact channel, processors and storage disclosures", () => {
    for (const language of ["en", "pt-BR"]) {
      const terms = termsSections(language, contact)
        .flatMap((section) => section.paragraphs)
        .join(" ");
      const privacy = privacySections(language, contact)
        .flatMap((section) => section.paragraphs)
        .join(" ");
      expect(terms).toContain(contact.companyName);
      expect(terms).toContain(contact.supportEmail);
      expect(privacy).toContain(contact.companyName);
      expect(privacy).toContain(contact.supportEmail);
      for (const disclosure of [
        "Neon",
        "Cloudflare",
        "Mistral AI",
        "Sentry",
        "Dodo Payments",
        "Merchant of Record",
        "mt_session",
        "mt_oauth_challenge",
        "localStorage",
        "IndexedDB",
      ])
        expect(privacy).toContain(disclosure);
    }
  });
});
