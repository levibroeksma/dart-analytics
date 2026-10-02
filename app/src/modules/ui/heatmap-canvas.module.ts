import {
  buildHeatLut,
  colorizeHeat,
} from "@modules/stats/sections/heatmap-density.module";
import type { HeatCanvasContext, HeatStamp } from "@modules/types";

let lut: Uint8ClampedArray | null = null;

function heatLut(): Uint8ClampedArray {
  lut ??= buildHeatLut();
  return lut;
}

/**
 * Draws a density heatmap onto a square canvas of `size` pixels: each stamp
 * is a black radial fade whose alpha accumulates where stamps overlap, then
 * the alpha channel is mapped through the colour ramp. Clears first; an
 * empty stamp list leaves the canvas clear.
 */
export function drawHeatmap(
  ctx: HeatCanvasContext,
  size: number,
  stamps: readonly HeatStamp[],
): void {
  ctx.clearRect(0, 0, size, size);
  if (stamps.length === 0) return;
  for (const stamp of stamps) {
    const x = stamp.x * size;
    const y = stamp.y * size;
    const r = stamp.radius * size;
    const gradient = ctx.createRadialGradient(x, y, 0, x, y, r);
    gradient.addColorStop(0, `rgba(0, 0, 0, ${stamp.alpha})`);
    gradient.addColorStop(1, "rgba(0, 0, 0, 0)");
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  const image = ctx.getImageData(0, 0, size, size);
  colorizeHeat(image.data, heatLut());
  ctx.putImageData(image, 0, 0);
}
