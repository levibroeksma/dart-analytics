import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const svgPath = fileURLToPath(
  new URL("../../../../src/assets/dartboard.svg", import.meta.url),
);
const astroPath = fileURLToPath(
  new URL("../../../../src/components/ui/DartBoard.astro", import.meta.url),
);
const svg = readFileSync(svgPath, "utf8");
const astro = readFileSync(astroPath, "utf8");

/**
 * DartBoard.astro inlines its own copy of the `<g class="dartboard-group">`
 * markup instead of importing dartboard.svg, so nothing forces the two to
 * agree. This suite extracts the meaningful content of that group from both
 * files — ids, classes, path outlines, circle radii, label text, all in
 * document order — and diffs it directly. A future edit landing in only one
 * copy fails here instead of silently mis-scoring darts in that sector.
 *
 * Order matters as much as membership: a transposed pair of adjacent
 * segments would pass a set comparison while still scoring every dart in
 * both sectors under the wrong number. Every list below is compared with
 * array equality, never sorted or deduped.
 */

function extractDartboardGroup(source: string): string {
  const start = source.indexOf('<g class="dartboard-group">');
  if (start === -1) {
    throw new Error('"<g class=\\"dartboard-group\\">" not found');
  }
  const tagPattern = /<g\b[^>]*>|<\/g>/g;
  tagPattern.lastIndex = start;
  let depth = 0;
  let match: RegExpExecArray | null;
  while ((match = tagPattern.exec(source))) {
    depth += match[0].startsWith("</g>") ? -1 : 1;
    if (depth === 0) {
      return source.slice(start, tagPattern.lastIndex);
    }
  }
  throw new Error("dartboard-group has unbalanced <g> tags");
}

function attrValuesIn(group: string, attr: "id" | "class"): string[] {
  const pattern = new RegExp(`\\s${attr}="([^"]*)"`, "g");
  return [...group.matchAll(pattern)].map((m) => m[1]);
}

function tagAttrValuesIn(
  group: string,
  tag: "path" | "circle",
  attr: "d" | "r",
): string[] {
  const tagPattern = new RegExp(`<${tag}\\b([^>]*)>`, "g");
  return [...group.matchAll(tagPattern)].map((m) => {
    const value = m[1].match(new RegExp(`\\b${attr}="([^"]*)"`));
    if (!value) {
      throw new Error(`<${tag}> missing ${attr} attribute`);
    }
    return value[1];
  });
}

function textContentsIn(group: string): string[] {
  return [...group.matchAll(/<text\b[^>]*>([\s\S]*?)<\/text>/g)].map((m) =>
    m[1].replace(/\s+/g, " ").trim(),
  );
}

const svgGroup = extractDartboardGroup(svg);
const astroGroup = extractDartboardGroup(astro);

describe("DartBoard.astro matches dartboard.svg", () => {
  it("uses the coordinate space the coordinate transform expects", () => {
    const viewBox = astro.match(/<svg\s[^>]*viewBox="([^"]+)"/)?.[1];
    expect(viewBox).toBe("-220,-220,440,440");
  });

  it("draws every id in the same order", () => {
    expect(attrValuesIn(astroGroup, "id")).toEqual(
      attrValuesIn(svgGroup, "id"),
    );
  });

  it("draws every class in the same order", () => {
    expect(attrValuesIn(astroGroup, "class")).toEqual(
      attrValuesIn(svgGroup, "class"),
    );
  });

  it("draws every path outline in the same order", () => {
    expect(tagAttrValuesIn(astroGroup, "path", "d")).toEqual(
      tagAttrValuesIn(svgGroup, "path", "d"),
    );
  });

  it("draws both bull circles at the same radii in the same order", () => {
    expect(tagAttrValuesIn(astroGroup, "circle", "r")).toEqual(
      tagAttrValuesIn(svgGroup, "circle", "r"),
    );
  });

  it("labels every segment with the same text in the same order", () => {
    expect(textContentsIn(astroGroup)).toEqual(textContentsIn(svgGroup));
  });
});
