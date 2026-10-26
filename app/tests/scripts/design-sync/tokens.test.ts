import { describe, expect, it } from "vitest";
import { normaliseCss, parseTokens } from "../../../scripts/design-sync/tokens";

describe("design-sync tokens", () => {
  it("parses custom properties from :root and @theme", () => {
    const t = parseTokens(
      ":root{--accent: oklch(68.5% 0.169 237.323);}\n@theme inline{--radius-row: 14px;}",
    );
    expect(t.map((x) => x.id)).toEqual(["var:--accent", "var:--radius-row"]);
  });

  it("treats code @utility and design .class as the same rule id", () => {
    expect(
      parseTokens("@utility glass { backdrop-filter: blur(8px); }")[0].id,
    ).toBe("rule:glass");
    expect(parseTokens(".glass { backdrop-filter: blur(8px); }")[0].id).toBe(
      "rule:glass",
    );
  });

  it("gives @utility and .class bodies the same value", () => {
    expect(
      parseTokens(
        "@utility glass { color: red; backdrop-filter: blur(8px); }",
      )[0].value,
    ).toBe(
      parseTokens(
        ".glass {\n  backdrop-filter: blur(8px);\n  color: RED;\n}",
      )[0].value,
    );
  });

  it("parses @keyframes", () => {
    expect(
      parseTokens("@keyframes sheet-in { from{opacity:0} to{opacity:1} }")[0]
        .id,
    ).toBe("keyframes:sheet-in");
  });

  it("finds @keyframes nested in @theme", () => {
    const ids = parseTokens(
      "@theme inline{--animate-x: x 1s;\n@keyframes x { from{opacity:0} }}",
    ).map((x) => x.id);
    expect(ids).toEqual(["var:--animate-x", "keyframes:x"]);
  });

  it("normalises whitespace, case, CRLF and trailing semicolons", () => {
    expect(normaliseCss("  OKLCH(68%  0.15 30) ;\r\n")).toBe(
      normaliseCss("oklch(68% 0.15 30)"),
    );
    expect(normaliseCss("#FFFFFF")).toBe("#ffffff");
  });

  it("drops @theme passthrough aliases", () => {
    expect(
      parseTokens("@theme inline{--color-accent: var(--accent);}"),
    ).toEqual([]);
  });

  it("keeps ; and braces inside quotes and parentheses out of the structure", () => {
    const t = parseTokens(
      ':root{--icon: url(data:image/svg+xml;utf8,<svg>{}</svg>); --q: "a;}b"; --e: "🎯";}\n@utility x { content: "{"; }',
    );
    expect(t.map((x) => [x.id, x.value])).toEqual([
      ["var:--icon", "url(data: image/svg+xml;utf8, <svg>{}</svg>)"],
      ["var:--q", '"a;}b"'],
      ["var:--e", '"🎯"'],
      ["rule:x", 'content: "{"'],
    ]);
  });

  it("ignores comments and @import", () => {
    expect(parseTokens('@import "x.css";\n/* --fake: 1; */')).toEqual([]);
  });

  it("skips compound selectors, @layer base and rule-local custom properties", () => {
    const ids = parseTokens(
      "@layer base { .x { color: red; } }\n.a .b { color: red; }\n.c:hover { color: red; }\n@utility d { --local: 1px; color: red; }",
    ).map((x) => x.id);
    expect(ids).toEqual(["rule:d"]);
  });
});
