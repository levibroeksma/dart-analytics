import { Resvg } from "@resvg/resvg-js";
import { describe, expect, it } from "vitest";
import {
  assertNonBlackPng,
  createIco,
  svgOklchToSrgb,
} from "../../scripts/generate-app-icons";

function renderSquare(fill: string, size: number): Buffer {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"><rect width="${size}" height="${size}" fill="${fill}"/></svg>`;
  return Buffer.from(new Resvg(svg).render().asPng());
}

describe("generate-app-icons helpers", () => {
  it("converts oklch colors to Resvg-compatible rgb", () => {
    const converted = svgOklchToSrgb(
      '<path fill="oklch(68.5% 0.169 237.323)"/>',
    );

    expect(converted).not.toContain("oklch");
    expect(converted).toMatch(/fill="rgb\(\d+, \d+, \d+\)"/);
  });

  it("rejects an all-black PNG", () => {
    expect(() => assertNonBlackPng(renderSquare("#000", 16), "black")).toThrow(
      "raster is all black",
    );
  });

  it("writes a two-frame PNG ICO directory", () => {
    const png16 = renderSquare("#fff", 16);
    const png32 = renderSquare("#fff", 32);
    const ico = createIco([
      { size: 16, png: png16 },
      { size: 32, png: png32 },
    ]);

    expect(ico.readUInt16LE(0)).toBe(0);
    expect(ico.readUInt16LE(2)).toBe(1);
    expect(ico.readUInt16LE(4)).toBe(2);
    expect(ico[6]).toBe(16);
    expect(ico[22]).toBe(32);
    expect(ico.readUInt32LE(18)).toBe(38);
    expect(ico.subarray(38, 38 + png16.length)).toEqual(png16);
    expect(ico.subarray(38 + png16.length)).toEqual(png32);
  });
});
