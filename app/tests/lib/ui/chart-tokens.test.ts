import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const css = readFileSync(
  new URL("../../../src/styles/global.css", import.meta.url),
  "utf8",
);
const card = readFileSync(
  new URL("../../../src/components/ui/CardWrapper.astro", import.meta.url),
  "utf8",
);

function cardTintNames(): string[] {
  const block = card.match(/const tintPresets[^{]*\{([\s\S]*?)\n\};/);
  if (!block) throw new Error("tintPresets not found in CardWrapper.astro");
  return [...block[1].matchAll(/^\s*(\w+):/gm)].map((m) => m[1]);
}

function chartTokenNames(): string[] {
  return [...css.matchAll(/^\s*--chart-(?!grid\b)(\w+):/gm)].map((m) => m[1]);
}

describe("chart color tokens", () => {
  it("has one --chart-<name> token per CardWrapper color name", () => {
    expect(chartTokenNames().sort()).toEqual(cardTintNames().sort());
  });

  it("has a grid token", () => {
    expect(css).toMatch(/^\s*--chart-grid:/m);
  });
});
