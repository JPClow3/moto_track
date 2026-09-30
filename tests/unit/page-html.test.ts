import { describe, expect, it } from "vitest";
import { preserveAppScripts } from "$server/domain/page-html";

describe("Cloudflare-safe hydration HTML", () => {
  it("excludes theme and generated bootstrap scripts without changing CSP nonces or bodies", () => {
    const html =
      '<script nonce="theme">theme()</script><script type="module" nonce="app">import("/_app/start.js")</script>';
    expect(preserveAppScripts(html)).toBe(
      '<script data-cfasync="false" nonce="theme">theme()</script><script data-cfasync="false" type="module" nonce="app">import("/_app/start.js")</script>',
    );
  });
  it("preserves an explicit script policy and is idempotent", () => {
    const html = '<script data-cfasync="false" src="/app.js"></script>';
    expect(preserveAppScripts(preserveAppScripts(html))).toBe(html);
  });
});
