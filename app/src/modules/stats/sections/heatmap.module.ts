import { isClosed } from "./series.module";
import type { SeriesBucket, TargetKey } from "@lib/types";
import type { HeatmapCellRow, HeatmapMetrics } from "@modules/types";

/** Square heatmap cell size in board millimetres (phase-2 decision 6); changing it bumps the section `version`. */
export const HEATMAP_CELL_MM = 5;

/** Folds `findHeatmapCells` rows (not bucketable) into a single grid bucket. Cell order follows the SQL result, unsorted. */
export function heatmapBuckets(
  rows: readonly HeatmapCellRow[],
  ctx: { from: string; to: string; now: Date; target: TargetKey | null },
): SeriesBucket<HeatmapMetrics>[] {
  if (rows.length === 0) return [];

  const cells: [number, number, number][] = rows.map((row) => [
    row.ix,
    row.iy,
    row.darts,
  ]);
  const sampleSize = rows.reduce((sum, row) => sum + row.darts, 0);

  return [
    {
      start: ctx.from,
      end: ctx.to,
      closed: isClosed(ctx.to, ctx.to, ctx.now),
      sampleSize,
      metrics: { cellMm: HEATMAP_CELL_MM, target: ctx.target, cells },
    },
  ];
}
