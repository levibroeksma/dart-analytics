import { describe, expect, it } from "vitest";
import {
  parseTokensJson,
  representable,
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
