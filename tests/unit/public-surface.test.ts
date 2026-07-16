import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = (path: string) =>
  readFileSync(resolve(process.cwd(), path), "utf8");

describe("public surface contracts", () => {
  it("publishes a canonical privacy page and links to it from the footer", () => {
    expect(source("src/routes/(public)/privacidade/+page.svelte")).toContain(
      "Política de Privacidade",
    );
    expect(source("src/lib/components/PublicFooter.svelte")).toContain(
      'href="/privacidade"',
    );
  });

  it("gives both legal documents dated, reviewable sections", () => {
    const terms = source("src/routes/(public)/termos/+page.svelte");
    const privacy = source("src/routes/(public)/privacidade/+page.svelte");

    expect(terms).toContain("Última atualização: 16 de julho de 2026");
    expect(terms).toContain("Limitações e responsabilidade");
    expect(privacy).toContain("Seus direitos pela LGPD");
    expect(privacy).toContain("privacidade@moto-track.app");
  });

  it("exposes an accessible sign-in and registration mode switch", () => {
    const auth = source("src/routes/auth/+page.svelte");

    expect(auth).toContain('aria-controls="auth-sign-in"');
    expect(auth).toContain('aria-controls="auth-sign-up"');
    expect(auth).toContain('action="?/signIn"');
    expect(auth).toContain('action="?/signUp"');
  });
});
