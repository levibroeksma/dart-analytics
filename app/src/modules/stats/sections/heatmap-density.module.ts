import type { HeatRampStop, HeatStamp, HeatmapMetrics } from "@modules/types";

/** Radius of a cell's density stamp in cells; wide enough that neighbouring cells blend into one blob. */
export const HEAT_RADIUS_CELLS = 5;

/** Alpha of the busiest cell's own stamp; below 1 so a single cell reads warm and only overlapping cells reach the hot end. Other cells scale on a square root so mid-density cells stay visible. */
export const HEAT_PEAK_ALPHA = 0.55;

/** Opacity of the hottest pixel; below 1 so the board stays legible under the heat. */
export const HEAT_MAX_ALPHA = 0.85;

/** Cool-to-hot ramp: blue, green, yellow, red (`decisions/frontend/alpine.md`, density heatmap). */
const HEAT_RAMP: readonly HeatRampStop[] = [
  { t: 0, rgb: [59, 130, 246] },
  { t: 0.3, rgb: [34, 197, 94] },
  { t: 0.6, rgb: [250, 204, 21] },
  { t: 1, rgb: [239, 68, 68] },
];

const LUT_SIZE = 256;

/** Density stamps for `heatmap` cells over a board whose SVG `viewBox` spans `spanMm` on each axis, centred on the bull. */
export function heatStamps(
  metrics: HeatmapMetrics,
  spanMm: number,
): HeatStamp[] {
  const { cellMm, cells } = metrics;
  const origin = spanMm / 2;
  const half = cellMm / 2;
  const radius = (HEAT_RADIUS_CELLS * cellMm) / spanMm;
  const maxDarts = cells.reduce((max, [, , darts]) => Math.max(max, darts), 0);
  return cells.map(([ix, iy, darts]) => ({
    x: (ix * cellMm + half + origin) / spanMm,
    y: (iy * cellMm + half + origin) / spanMm,
    radius,
    alpha: maxDarts === 0 ? 0 : Math.sqrt(darts / maxDarts) * HEAT_PEAK_ALPHA,
  }));
}

/** The ramp colour at `t`, linearly blended between stops and clamped to [0, 1]. */
export function heatColor(t: number): [number, number, number] {
  const at = Math.min(1, Math.max(0, t));
  let lower = HEAT_RAMP[0];
  let upper = HEAT_RAMP[HEAT_RAMP.length - 1];
  for (let i = 0; i < HEAT_RAMP.length - 1; i++) {
    if (at >= HEAT_RAMP[i].t && at <= HEAT_RAMP[i + 1].t) {
      lower = HEAT_RAMP[i];
      upper = HEAT_RAMP[i + 1];
      break;
    }
  }
  const span = upper.t - lower.t;
  const mix = span === 0 ? 0 : (at - lower.t) / span;
  return [0, 1, 2].map((c) =>
    Math.round(lower.rgb[c] + (upper.rgb[c] - lower.rgb[c]) * mix),
  ) as [number, number, number];
}

/** A 256-entry rgb lookup of the ramp, indexed by a pixel's accumulated alpha. */
export function buildHeatLut(): Uint8ClampedArray {
  const lut = new Uint8ClampedArray(LUT_SIZE * 3);
  for (let i = 0; i < LUT_SIZE; i++) {
    lut.set(heatColor(i / (LUT_SIZE - 1)), i * 3);
  }
  return lut;
}

/**
 * Recolours accumulated-alpha pixels in place: rgb from the lookup at that
 * alpha, alpha lifted on a square root so faint edges stay visible and
 * capped at `HEAT_MAX_ALPHA`. Fully transparent pixels are left alone.
 */
export function colorizeHeat(
  pixels: Uint8ClampedArray,
  lut: Uint8ClampedArray,
): void {
  for (let i = 0; i < pixels.length; i += 4) {
    const alpha = pixels[i + 3];
    if (alpha === 0) continue;
    const offset = alpha * 3;
    pixels[i] = lut[offset];
    pixels[i + 1] = lut[offset + 1];
    pixels[i + 2] = lut[offset + 2];
    pixels[i + 3] = Math.round(255 * HEAT_MAX_ALPHA * Math.sqrt(alpha / 255));
  }
}
