import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const appHtml = readFileSync(
  new URL("../../src/app.html", import.meta.url),
  "utf8",
);

describe("Sentry loader", () => {
  it("loads the configured browser SDK with anonymous CORS", () => {
    expect(appHtml).toMatch(
      /<script\s+src="https:\/\/js\.sentry-cdn\.com\/08e9ee7d9e7558988cd107dff4092f39\.min\.js"\s+crossorigin="anonymous"\s*><\/script>/,
    );
  });
});
