import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const appHtml = readFileSync(
  new URL("../../src/app.html", import.meta.url),
  "utf8",
);
const rootLayout = readFileSync(
  new URL("../../src/routes/+layout.svelte", import.meta.url),
  "utf8",
);

describe("Sentry browser integration", () => {
  it("uses one DSN-gated SDK path without sending default PII", () => {
    expect(appHtml).not.toContain("js.sentry-cdn.com");
    expect(rootLayout).toContain("import.meta.env.PUBLIC_SENTRY_DSN");
    expect(rootLayout).toContain('import("@sentry/browser")');
    expect(rootLayout).toContain("sendDefaultPii: false");
  });
});
