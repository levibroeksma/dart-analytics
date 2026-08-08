import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { BOARD_RADII_MM } from "@lib/game/board/board-geometry.module";

const svgPath = fileURLToPath(
  new URL("../../../../src/assets/dartboard.svg", import.meta.url),
);
const svg = readFileSync(svgPath, "utf8");

function arcRadiiIn(source: string): Set<number> {
  const radii = new Set<number>();
  for (const match of source.matchAll(/A(\d+(?:\.\d+)?),/g)) {
    radii.add(Number(match[1]));
  }
  return radii;
}

function circleRadiiIn(source: string): Set<number> {
  const radii = new Set<number>();
  for (const match of source.matchAll(/r="(\d+(?:\.\d+)?)"/g)) {
    radii.add(Number(match[1]));
  }
  return radii;
}

describe("dartboard.svg matches the geometry module", () => {
  it("draws every segment ring at a radius the classifier knows", () => {
    const drawn = arcRadiiIn(svg);
    for (const radius of [
      BOARD_RADII_MM.trebleInner,
      BOARD_RADII_MM.trebleOuter,
      BOARD_RADII_MM.doubleInner,
      BOARD_RADII_MM.doubleOuter,
    ]) {
      expect(drawn).toContain(radius);
    }
  });

  it("draws both bull circles at the radii the classifier knows", () => {
    const drawn = circleRadiiIn(svg);
    expect(drawn).toContain(BOARD_RADII_MM.innerBull);
    expect(drawn).toContain(BOARD_RADII_MM.outerBull);
  });

  it("uses a viewBox that contains the surround", () => {
    const viewBox = svg.match(/viewBox="([^"]+)"/)?.[1];
    expect(viewBox).toBeDefined();
    const [minX, minY, width, height] = viewBox!
      .split(/[\s,]+/)
      .map(Number) as [number, number, number, number];
    expect(Math.abs(minX)).toBeGreaterThanOrEqual(BOARD_RADII_MM.surroundOuter);
    expect(Math.abs(minY)).toBeGreaterThanOrEqual(BOARD_RADII_MM.surroundOuter);
    expect(width).toBeGreaterThanOrEqual(BOARD_RADII_MM.surroundOuter * 2);
    expect(height).toBeGreaterThanOrEqual(BOARD_RADII_MM.surroundOuter * 2);
  });
});
