import { drawHeatmap } from "@modules/ui/heatmap-canvas.module";
import type { HeatStamp } from "@modules/types";

type HeatmapCanvasContext = { $refs: { canvas?: HTMLCanvasElement } };

/** Fixed square backing resolution of the heatmap canvas; CSS scales it to the board. */
export const HEATMAP_CANVAS_PX = 512;

/** Alpine factory for `StatsDensityHeatmap.astro`: `draw(stamps)` paints the density layer onto the `canvas` ref. */
export function heatmapCanvas() {
  return {
    draw(this: HeatmapCanvasContext, stamps: readonly HeatStamp[]) {
      const canvas = this.$refs.canvas;
      if (!canvas) return;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) return;
      canvas.width = HEATMAP_CANVAS_PX;
      canvas.height = HEATMAP_CANVAS_PX;
      drawHeatmap(ctx, HEATMAP_CANVAS_PX, stamps);
    },
  };
}
