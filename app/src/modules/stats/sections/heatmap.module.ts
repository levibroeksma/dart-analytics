import { aimMatchesTarget } from "@lib/stats/target-key";
import { aimedDarts } from "../derived-aims.module";
import { isClosed } from "./series.module";
import type { IntentZoneKey, SeriesBucket, TargetKey } from "@lib/types";
import type {
  HeatmapCellRow,
  HeatmapMetrics,
  SessionSteps,
} from "@modules/types";

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

/**
 * `findHeatmapCells`'s fold-side twin for a derived game (Group C): every
 * dart whose recovered aim matches `target`, binned with the same
 * `floor(x / cellMm)` as the SQL `FLOOR`.
 */
export function heatmapCellRowsFromAims(
  sessions: readonly SessionSteps<unknown>[],
  target: { number: number; zone: IntentZoneKey },
): HeatmapCellRow[] {
  const cells = new Map<string, HeatmapCellRow>();

  for (const session of sessions) {
    for (const dart of aimedDarts(session)) {
      if (!aimMatchesTarget(dart.aim, target)) continue;
      const ix = Math.floor(dart.x / HEATMAP_CELL_MM);
      const iy = Math.floor(dart.y / HEATMAP_CELL_MM);
      const key = `${ix},${iy}`;
      const existing = cells.get(key);
      if (existing) {
        existing.darts += 1;
        continue;
      }
      cells.set(key, { ix, iy, darts: 1 });
    }
  }

  return [...cells.values()];
}
