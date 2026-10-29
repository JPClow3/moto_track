import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { legalCopy, privacySections, termsSections } from "$lib/i18n/legal";

const source = (path: string) =>
  readFileSync(resolve(process.cwd(), path), "utf8");

describe("public surface contracts", () => {
  it("publishes a canonical privacy page and links to it from the footer", () => {
    const privacy = source("src/routes/(public)/privacidade/+page.svelte");
    expect(legalCopy("pt-BR").privacy.title).toBe("Política de Privacidade");
    expect(privacy).toContain("{copy.privacy.title}");
    expect(privacy).toContain(
      'rel="canonical" href="https://moto-track.net/privacidade"',
    );
    expect(source("src/lib/components/PublicFooter.svelte")).toContain(
      'href="/privacidade"',
    );
  });

  it("gives both legal documents dated, reviewable sections", () => {
    const terms = source("src/routes/(public)/termos/+page.svelte");
    const privacy = source("src/routes/(public)/privacidade/+page.svelte");
    const contact = {
      companyName: "Test operator",
      supportEmail: "support@example.test",
    };
    const copy = legalCopy("pt-BR");
    const termsContent = JSON.stringify(termsSections("pt-BR", contact));
    const privacyContent = JSON.stringify(privacySections("pt-BR", contact));
    const publishedContent = `${terms}\n${privacy}\n${termsContent}\n${privacyContent}`;

    expect(copy.updated).toBe("Última atualização: 29 de setembro de 2026");
    for (const document of [terms, privacy]) {
      expect(document).toContain("{copy.updated}");
      expect(document).toContain("{#each sections as section");
      expect(document).toContain("{section.title}");
      expect(document).toContain("{paragraph}");
    }
    expect(terms).toContain("termsSections($locale, data.contact)");
    expect(privacy).toContain("privacySections($locale, data.contact)");
    expect(termsContent).toContain("Limitações e responsabilidade");
    expect(privacyContent).toContain("Seus direitos pela LGPD");
    expect(privacy).toContain('href="/billing/conta"');
    // The GitHub security advisory form is not a privacy/consumer channel;
    // both documents route requests to the support email instead.
    expect(publishedContent).not.toContain("security/advisories/new");
    expect(terms).toContain("href={`mailto:${supportEmail}`}");
    expect(privacy).toContain("href={`mailto:${supportEmail}`}");
    expect(privacyContent).toContain("em até 90 dias");
    expect(publishedContent).not.toMatch(/minuta|revisão jurídica/i);
    expect(publishedContent).not.toContain("privacidade@moto-track.app");
  });

  it("exposes an accessible sign-in and registration mode switch", () => {
    const auth = source("src/routes/auth/+page.svelte");

    expect(auth).toContain('aria-controls="auth-sign-in"');
    expect(auth).toContain('aria-controls="auth-sign-up"');
    expect(auth).toContain('action="?/signIn"');
    expect(auth).toContain('action="?/signUp"');
  });

  it("keeps the persisted theme mirror and browser chrome color in sync", () => {
    const bootstrap = source("src/app.html");
    const layout = source("src/routes/+layout.svelte");

    expect(bootstrap).toContain('id="theme-color"');
    expect(bootstrap).toContain(
      "window.localStorage.getItem(THEME_STORAGE_KEY)",
    );
    expect(bootstrap).toContain(
      'setAttribute("content", THEME_COLORS[resolved])',
    );
    expect(layout).toContain(
      "window.localStorage.setItem(THEME_STORAGE_KEY, preference)",
    );
    expect(layout).toContain("meta[name='theme-color']");
  });

  it("publishes the completed benchmark and marketplace capabilities honestly", () => {
    const roadmap = source("src/routes/(public)/roadmap/+page.svelte");

    expect(roadmap).toContain("Comparativo anônimo por modelo");
    expect(roadmap).toContain("pelo menos cinco participantes válidos");
    expect(roadmap).toContain("Busca de peças no Mercado Livre");
    expect(roadmap).toContain("diretamente no Mercado Livre");
    expect(roadmap).not.toContain("Comparação anônima por modelo");
  });
});
