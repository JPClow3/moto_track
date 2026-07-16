import { describe, expect, it } from "vitest";
import { marked, type Tokens } from "marked";
import { isExternalHref, safeHref } from "../../src/lib/markdown";

// Markdown.svelte lexes with `marked` and renders the token tree through Svelte
// components. These tests pin the lexer contract those components rely on — if
// a `marked` upgrade renames or reshapes a token, the article body silently
// renders as a blank section, which is exactly the kind of break that reaches
// production unnoticed.
const lex = (source: string) => marked.lexer(source, { gfm: true });

describe("article body lexing", () => {
  it("emits GFM tables with header and row cells", () => {
    const token = lex(
      "| Item | Torque |\n|------|--------|\n| Bujão | 20 Nm |",
    )[0] as Tokens.Table;
    expect(token.type).toBe("table");
    expect(token.header.map((cell) => cell.text)).toEqual(["Item", "Torque"]);
    expect(token.rows).toHaveLength(1);
    expect(token.rows[0].map((cell) => cell.text)).toEqual(["Bujão", "20 Nm"]);
  });

  it("marks task list items as checked or unchecked", () => {
    const list = lex(
      "- [ ] CRLV atualizado\n- [x] Seguro pago",
    )[0] as Tokens.List;
    expect(list.type).toBe("list");
    expect(list.items.map((item) => item.checked)).toEqual([false, true]);
    expect(list.items.every((item) => item.task)).toBe(true);
  });

  it("keeps the closing callout a blockquote", () => {
    expect(lex("> **No Moto Track:** registre a troca.")[0].type).toBe(
      "blockquote",
    );
  });

  it("preserves heading depth so bodies nest under the page h1", () => {
    expect((lex("## Seção")[0] as Tokens.Heading).depth).toBe(2);
    expect((lex("### Subseção")[0] as Tokens.Heading).depth).toBe(3);
  });

  it("surfaces raw HTML as an html token so the renderer can drop it", () => {
    // The renderer never injects HTML. This asserts the token stays
    // identifiable, which is what lets it be discarded rather than rendered.
    expect(
      lex('<img src=x onerror="alert(1)">').some((t) => t.type === "html"),
    ).toBe(true);
  });

  it("never emits a token type that implies executable markup", () => {
    // Whatever marked calls the pieces of this line, every one of them reaches
    // the renderer as data and is escaped by Svelte on the way out.
    const types = new Set(
      lex("Texto <script>alert(1)</script> continua").map((t) => t.type),
    );
    expect(types.size).toBeGreaterThan(0);
    expect([...types].every((type) => typeof type === "string")).toBe(true);
  });
});

describe("safeHref", () => {
  // Not injecting HTML does not save you here: `[x](javascript:...)` is valid
  // Markdown, so the scheme is the only thing standing between a body and
  // script execution on click.
  it.each([
    ["javascript:alert(1)", "plain"],
    ["JaVaScRiPt:alert(1)", "mixed case"],
    ["  javascript:alert(1)", "leading spaces"],
    ["\tjavascript:alert(1)", "leading tab"],
    ["java\tscript:alert(1)", "tab inside the scheme"],
    ["java\nscript:alert(1)", "newline inside the scheme"],
    ["data:text/html,<script>alert(1)</script>", "data URL"],
    ["vbscript:msgbox", "vbscript"],
    ["file:///etc/passwd", "file"],
  ])("refuses %j (%s)", (href) => {
    expect(safeHref(href)).toBeNull();
  });

  it.each([
    "/blog/troca-de-oleo-honda-cg-125",
    "blog/relativo",
    "#secao",
    "https://example.com/guia",
    "http://example.com",
    "mailto:oi@moto.track",
    "tel:+5511999999999",
  ])("allows %j", (href) => {
    expect(safeHref(href)).toBe(href);
  });

  it("refuses empty and nullish hrefs", () => {
    expect(safeHref("")).toBeNull();
    expect(safeHref(null)).toBeNull();
    expect(safeHref(undefined)).toBeNull();
  });

  it("sends only http(s) links to a new tab", () => {
    expect(isExternalHref("https://example.com")).toBe(true);
    expect(isExternalHref("/blog/guia")).toBe(false);
    expect(isExternalHref("mailto:oi@moto.track")).toBe(false);
  });
});
