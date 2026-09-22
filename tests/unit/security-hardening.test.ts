import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const hooks = readFileSync(
  new URL("../../src/hooks.server.ts", import.meta.url),
  "utf8",
);
const svelteConfig = readFileSync(
  new URL("../../svelte.config.js", import.meta.url),
  "utf8",
);
const appHtml = readFileSync(
  new URL("../../src/app.html", import.meta.url),
  "utf8",
);

describe("browser security hardening", () => {
  it("applies transport and browser isolation headers", () => {
    for (const header of [
      "Strict-Transport-Security",
      "X-Content-Type-Options",
      "X-Frame-Options",
      "Referrer-Policy",
      "Permissions-Policy",
    ]) {
      expect(hooks).toContain(header);
    }
  });

  it("uses SvelteKit nonces with a restrictive CSP", () => {
    expect(appHtml).toContain('nonce="%sveltekit.nonce%"');
    expect(svelteConfig).toContain('"default-src": ["self"]');
    expect(svelteConfig).toContain('"frame-ancestors": ["none"]');
    expect(svelteConfig).toContain('"object-src": ["none"]');
    expect(svelteConfig).toContain(
      '"img-src": ["self", "data:", "blob:", "https:"]',
    );
  });
});
