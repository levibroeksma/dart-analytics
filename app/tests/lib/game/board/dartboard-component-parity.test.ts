import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { BOARD_SEGMENTS } from "@lib/ui/dart-board-segments";
import type { BoardSegment } from "@lib/types";

const svgPath = fileURLToPath(
  new URL("../../../../src/assets/dartboard.svg", import.meta.url),
);
const astroPath = fileURLToPath(
  new URL("../../../../src/components/ui/DartBoard.astro", import.meta.url),
);
const svg = readFileSync(svgPath, "utf8");
const astro = readFileSync(astroPath, "utf8");

/**
 * DartBoard.astro draws its own `<g class="dartboard-group">` instead of
 * importing dartboard.svg: one segment template looped over `BOARD_SEGMENTS`,
 * then the bull. Nothing forces that to agree with the SVG. This suite
 * expands the loop with the segment data, exactly as the build does, then
 * extracts the meaningful content of the group from both files — ids, classes, path outlines, circle radii, label text, all in
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

/**
 * The group as the build renders it: the `BOARD_SEGMENTS.map(...)` block
 * replaced by its template once per segment, each `{segment.x}` filled in.
 */
function expandSegmentLoop(group: string): string {
  const loop = group.match(
    /\{\s*BOARD_SEGMENTS\.map\(\(segment\) => \(([\s\S]*?)\)\)\s*\}/,
  );
  if (!loop) throw new Error("BOARD_SEGMENTS.map(...) block not found");
  const template = loop[1];
  const rendered = BOARD_SEGMENTS.map((segment) =>
    template
      .replace("{`segment ${segment.tone}`}", `"segment ${segment.tone}"`)
      .replace(/\{segment\.(\w+)\}/g, (_, key: keyof BoardSegment) =>
        key === "label" ? segment.label : `"${segment[key]}"`,
      ),
  );
  return group.replace(loop[0], rendered.join("\n"));
}

const svgGroup = extractDartboardGroup(svg);
const astroGroup = expandSegmentLoop(extractDartboardGroup(astro));

describe("DartBoard.astro matches dartboard.svg", () => {
  it("uses the coordinate space the coordinate transform expects", () => {
    const viewBox = astro.match(/<svg\s[^>]*viewBox="([^"]+)"/)?.[1];
    expect(viewBox).toBe("-220,-220,440,440");
  });

  it("loops over all twenty segments, leaving no unfilled placeholder", () => {
    expect(BOARD_SEGMENTS).toHaveLength(20);
    expect(astroGroup).not.toMatch(/\{segment\b/);
  });

  it("carries no id, so a page can mount several boards (#645)", () => {
    expect(attrValuesIn(astroGroup, "id")).toEqual([]);
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

describe("BoardMagnifier.astro agrees with the board's coordinate space", () => {
  /**
   * The magnifier renders a second board inside a fixed-size box and scales it
   * by `zoom * pxPerMm`, with the pan expressed in raw px. That maths is only
   * correct while the inner board is exactly 1 px per board millimetre — i.e.
   * while its box matches the viewBox's extent. The parity test above pins the
   * viewBox between the asset and the component, but knows nothing about the
   * magnifier, so changing the viewBox would fail there, get the expected
   * string updated, and leave the magnifier silently misaligned. This closes
   * that gap: the third copy of the 440 mm extent is now pinned to the first.
   */
  const magnifier = readFileSync(
    fileURLToPath(
      new URL(
        "../../../../src/components/ui/BoardMagnifier.astro",
        import.meta.url,
      ),
    ),
    "utf8",
  );

  it("sizes its inner board to the viewBox extent", () => {
    const viewBox = astro.match(/<svg\s[^>]*viewBox="([^"]+)"/)?.[1];
    const extent = viewBox!.split(",")[2];

    // Tailwind spacing is 4px per step, so size-110 is 440px.
    expect(magnifier).toContain(`size-${Number(extent) / 4} `);
  });
});
