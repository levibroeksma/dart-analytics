import { describe, expect, it, vi } from "vitest";
import { drawHeatmap } from "@modules/ui/heatmap-canvas.module";
import type { HeatCanvasContext, HeatStamp } from "@modules/types";

function fakeContext(size: number) {
  const data = new Uint8ClampedArray(size * size * 4);
  const stops: [number, string][] = [];
  const arcs: number[][] = [];
  const ctx = {
    fillStyle: "" as string | CanvasGradient,
    clearRect: vi.fn(),
    createRadialGradient: vi.fn(() => ({
      addColorStop: (offset: number, color: string) => {
        stops.push([offset, color]);
      },
    })),
    beginPath: vi.fn(),
    arc: vi.fn((...args: number[]) => {
      arcs.push(args);
    }),
    fill: vi.fn(() => {
      data.fill(255);
    }),
    getImageData: vi.fn(() => ({ data })),
    putImageData: vi.fn(),
  };
  return { ctx: ctx as unknown as HeatCanvasContext, data, stops, arcs };
}

const STAMP: HeatStamp = { x: 0.5, y: 0.25, radius: 0.1, alpha: 0.5 };

describe("drawHeatmap", () => {
  it("stamps each point as a radial fade scaled to the canvas size", () => {
    const { ctx, stops, arcs } = fakeContext(2);
    drawHeatmap(ctx, 200, [STAMP]);
    expect(ctx.clearRect).toHaveBeenCalledWith(0, 0, 200, 200);
    expect(ctx.createRadialGradient).toHaveBeenCalledWith(
      100,
      50,
      0,
      100,
      50,
      20,
    );
    expect(stops).toEqual([
      [0, "rgba(0, 0, 0, 0.5)"],
      [1, "rgba(0, 0, 0, 0)"],
    ]);
    expect(arcs[0].slice(0, 3)).toEqual([100, 50, 20]);
  });

  it("colourises the accumulated alpha and writes it back", () => {
    const { ctx, data } = fakeContext(1);
    drawHeatmap(ctx, 1, [STAMP]);
    expect(ctx.putImageData).toHaveBeenCalledWith({ data }, 0, 0);
    expect(Array.from(data.slice(0, 3))).toEqual([239, 68, 68]);
  });

  it("only clears when there are no stamps", () => {
    const { ctx } = fakeContext(1);
    drawHeatmap(ctx, 1, []);
    expect(ctx.clearRect).toHaveBeenCalledOnce();
    expect(ctx.getImageData).not.toHaveBeenCalled();
  });
});
