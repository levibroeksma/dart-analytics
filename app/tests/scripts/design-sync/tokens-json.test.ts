import { describe, expect, it } from "vitest";
import {
  parseTokensJson,
  representable,
  writeTokensJson,
} from "../../../scripts/design-sync/tokens-json";

const json = (o: unknown): string => JSON.stringify(o);

describe("design-sync tokens.json", () => {
  it("maps families to var ids", () => {
    expect(
      parseTokensJson(
        json({
          radius: { tokens: [{ name: "radius-card", value: "1.25rem" }] },
        }),
      ),
    ).toEqual([
      {
        id: "var:--radius-card",
        kind: "var",
        name: "--radius-card",
        value: "1.25rem",
      },
    ]);
  });

  it("uses the first theme", () => {
    const t = parseTokensJson(
      json({
        color: {
          themes: [{ id: "dark" }, { id: "light" }],
          tokens: [
            { name: "bg", value: { light: "#fff", dark: "oklch(20% 0 0)" } },
          ],
        },
      }),
    );
    expect(t[0].value).toBe("oklch(20% 0 0)");
  });

  it("turns aliases into var()", () => {
    const t = parseTokensJson(
      json({
        color: {
          themes: [{ id: "dark" }],
          tokens: [{ name: "focus", value: "{accent}" }],
        },
      }),
    );
    expect(t[0].value).toBe("var(--accent)");
  });

  it("skips type styles and maps type families to --font-<key>", () => {
    const t = parseTokensJson(
      json({
        name: "x",
        version: 1,
        type: {
          families: { display: "'Bebas Neue', sans-serif" },
          groups: [{ name: "g", styles: [{ name: "hero", fontSize: "3rem" }] }],
        },
      }),
    );
    expect(t).toEqual([
      {
        id: "var:--font-display",
        kind: "var",
        name: "--font-display",
        value: "'bebas neue', sans-serif",
      },
    ]);
  });

  it("replaces one value and keeps the rest", () => {
    const text = JSON.stringify(
      {
        name: "x",
        radius: {
          note: "n",
          tokens: [
            { name: "radius", value: "0.5rem", usage: "Default." },
            { name: "radius-pill", value: "999rem", usage: "Pills." },
          ],
        },
      },
      null,
      2,
    );
    const out = writeTokensJson(text, { "--radius": "0.75rem" });
    expect(out).toBe(text.replace('"0.5rem"', '"0.75rem"'));
  });

  it("keeps a trailing newline", () => {
    const text = `${JSON.stringify({ r: { tokens: [{ name: "a", value: "1rem" }] } }, null, 2)}\n`;
    expect(writeTokensJson(text, { "--a": "2rem" }).endsWith("}\n")).toBe(true);
  });

  it("replaces the first theme only", () => {
    const text = JSON.stringify({
      color: {
        themes: [{ id: "dark" }, { id: "light" }],
        tokens: [{ name: "bg", value: { dark: "#000", light: "#fff" } }],
      },
    });
    const out = JSON.parse(writeTokensJson(text, { "--bg": "#111" }));
    expect(out.color.tokens[0].value).toEqual({ dark: "#111", light: "#fff" });
  });

  it("writes type families by --font-<key>", () => {
    const text = JSON.stringify({ type: { families: { display: "A" } } });
    const out = JSON.parse(writeTokensJson(text, { "--font-display": "B" }));
    expect(out.type.families.display).toBe("B");
  });

  it("throws on a missing name", () => {
    expect(() => writeTokensJson("{}", { "--nope": "1rem" })).toThrow(
      "tokens.json: no token nope",
    );
  });

  it("throws on malformed json", () => {
    expect(() => parseTokensJson("{nope")).toThrow(/^tokens\.json: /);
  });

  it.each([
    ["color-mix(in oklch, red, blue)", false],
    ["var(--x)", false],
    ["calc(1rem + 2px)", false],
    ["transparent", false],
    ["currentColor", false],
    ["white", false],
    ["0.75rem", true],
    ["oklch(68.5% 0.169 237.323)", true],
    ["blur(0.5rem)", true],
  ])("representable(%s) is %s", (value, expected) => {
    expect(representable(value)).toBe(expected);
  });
});
