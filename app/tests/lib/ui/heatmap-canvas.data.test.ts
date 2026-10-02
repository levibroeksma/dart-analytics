import { beforeEach, describe, expect, it, vi } from "vitest";
import type { HeatStamp } from "@modules/types";

const drawHeatmap = vi.fn();

vi.mock("@modules/ui/heatmap-canvas.module", () => ({
  drawHeatmap: (...args: unknown[]) => drawHeatmap(...args),
}));

const { HEATMAP_CANVAS_PX, heatmapCanvas } =
  await import("@lib/ui/heatmap-canvas.data");

const STAMPS: HeatStamp[] = [{ x: 0.5, y: 0.5, radius: 0.1, alpha: 1 }];

function fakeCanvas() {
  const ctx = { tag: "ctx" };
  return {
    width: 0,
    height: 0,
    getContext: vi.fn(() => ctx),
    ctx,
  };
}

function context(canvas: ReturnType<typeof fakeCanvas> | undefined) {
  return Object.assign(heatmapCanvas(), {
    $refs: { canvas: canvas as unknown as HTMLCanvasElement | undefined },
  });
}

beforeEach(() => {
  drawHeatmap.mockReset();
});

describe("heatmapCanvas", () => {
  it("sizes the canvas square at HEATMAP_CANVAS_PX and draws the stamps", () => {
    const canvas = fakeCanvas();
    context(canvas).draw(STAMPS);
    expect(canvas.width).toBe(HEATMAP_CANVAS_PX);
    expect(canvas.height).toBe(HEATMAP_CANVAS_PX);
    expect(drawHeatmap).toHaveBeenCalledWith(
      canvas.ctx,
      HEATMAP_CANVAS_PX,
      STAMPS,
    );
  });

  it("draws nothing without a canvas ref or a 2d context", () => {
    context(undefined).draw(STAMPS);
    const canvas = fakeCanvas();
    canvas.getContext.mockReturnValue(null as never);
    context(canvas).draw(STAMPS);
    expect(drawHeatmap).not.toHaveBeenCalled();
  });

  it("asks for a context that will be read back", () => {
    const canvas = fakeCanvas();
    context(canvas).draw(STAMPS);
    expect(canvas.getContext).toHaveBeenCalledWith("2d", {
      willReadFrequently: true,
    });
  });
});
