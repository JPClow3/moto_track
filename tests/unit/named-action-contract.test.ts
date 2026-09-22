import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const routeFiles = [
  "documents",
  "expenses",
  "maintenance",
  "reminders",
  "tires",
  "trabalho",
].map((route) => `src/routes/(app)/${route}/+page.server.ts`);

describe("SvelteKit named action contract", () => {
  it.each(routeFiles)("does not mix a default action into %s", (file) => {
    const source = readFileSync(file, "utf8");

    expect(source).not.toMatch(/\.\.\.(?:base|baseActions),/);
  });

  it("posts generic feature forms to the named record action", () => {
    const source = readFileSync(
      "src/lib/components/FeaturePage.svelte",
      "utf8",
    );

    expect(source.match(/action="\?\/record"/g)).toHaveLength(3);
  });
});
