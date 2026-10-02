import { describe, expect, it } from "vitest";
import {
  HEAT_MAX_ALPHA,
  HEAT_PEAK_ALPHA,
  HEAT_RADIUS_CELLS,
  buildHeatLut,
  colorizeHeat,
  heatColor,
  heatStamps,
} from "@modules/stats/sections/heatmap-density.module";
import type { HeatmapMetrics } from "@modules/types";

const SPAN = 440;

function metrics(cells: [number, number, number][]): HeatmapMetrics {
  return { cellMm: 5, target: null, cells };
}

describe("heatStamps", () => {
  it("centres each cell as a fraction of the board span with origin at the board centre", () => {
    const [stamp] = heatStamps(metrics([[0, 0, 3]]), SPAN);
    expect(stamp.x).toBeCloseTo((2.5 + 220) / SPAN);
    expect(stamp.y).toBeCloseTo((2.5 + 220) / SPAN);
  });

  it("uses a radius of HEAT_RADIUS_CELLS cells", () => {
    const [stamp] = heatStamps(metrics([[0, 0, 3]]), SPAN);
    expect(stamp.radius).toBeCloseTo((HEAT_RADIUS_CELLS * 5) / SPAN);
  });

  it("scales alpha to the square root of darts over the busiest cell, peaking at HEAT_PEAK_ALPHA", () => {
    const stamps = heatStamps(
      metrics([
        [0, 0, 4],
        [-3, 2, 1],
      ]),
      SPAN,
    );
    expect(HEAT_PEAK_ALPHA).toBeLessThan(1);
    expect(stamps.map((s) => s.alpha)).toEqual([
      HEAT_PEAK_ALPHA,
      HEAT_PEAK_ALPHA / 2,
    ]);
  });

  it("is empty for no cells", () => {
    expect(heatStamps(metrics([]), SPAN)).toEqual([]);
  });
});

describe("heatColor", () => {
  it("runs blue → green → yellow → red", () => {
    expect(heatColor(0)).toEqual([59, 130, 246]);
    expect(heatColor(1)).toEqual([239, 68, 68]);
    const [r, g, b] = heatColor(0.3);
    expect(g).toBeGreaterThan(r);
    expect(g).toBeGreaterThan(b);
  });

  it("clamps outside [0, 1]", () => {
    expect(heatColor(-1)).toEqual(heatColor(0));
    expect(heatColor(2)).toEqual(heatColor(1));
  });
});

describe("buildHeatLut", () => {
  it("has 256 rgb entries ending on the ramp's ends", () => {
    const lut = buildHeatLut();
    expect(lut.length).toBe(256 * 3);
    expect(Array.from(lut.slice(0, 3))).toEqual(heatColor(0));
    expect(Array.from(lut.slice(255 * 3))).toEqual(heatColor(1));
  });
});

describe("colorizeHeat", () => {
  it("leaves fully transparent pixels untouched", () => {
    const px = new Uint8ClampedArray([0, 0, 0, 0]);
    colorizeHeat(px, buildHeatLut());
    expect(Array.from(px)).toEqual([0, 0, 0, 0]);
  });

  it("paints an opaque pixel the ramp's hot end at HEAT_MAX_ALPHA", () => {
    const px = new Uint8ClampedArray([0, 0, 0, 255]);
    colorizeHeat(px, buildHeatLut());
    expect(Array.from(px.slice(0, 3))).toEqual(heatColor(1));
    expect(px[3]).toBe(Math.round(255 * HEAT_MAX_ALPHA));
  });

  it("lifts faint pixels so the cool edge stays visible", () => {
    const px = new Uint8ClampedArray([0, 0, 0, 16]);
    colorizeHeat(px, buildHeatLut());
    expect(px[3]).toBeGreaterThan(16);
    expect(px[3]).toBeLessThan(Math.round(255 * HEAT_MAX_ALPHA));
  });
});
