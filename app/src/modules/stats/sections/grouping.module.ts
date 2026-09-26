import { zoneCentroid } from "@lib/game/board/board-geometry.module";
import { intendedKey } from "./intent-cells.module";
import { isClosed } from "./series.module";
import type { BoardPoint, IntentZoneKey, SeriesBucket } from "@lib/types";
import type {
  GroupingMetrics,
  GroupingMoment,
  IntentMomentRow,
} from "@modules/types";

/** Folds `findIntentMoments` rows into `grouping` buckets: summed position moments per intended target. */
export function groupingBuckets(
  rows: readonly IntentMomentRow[],
  ctx: { to: string; now: Date },
): SeriesBucket<GroupingMetrics>[] {
  const buckets = new Map<
    string,
    { end: string; metrics: GroupingMetrics; sampleSize: number }
  >();

  for (const row of rows) {
    const bucket = buckets.get(row.bucketStart) ?? {
      end: row.bucketEnd,
      metrics: {},
      sampleSize: 0,
    };
    bucket.sampleSize += row.n;

    const key = intendedKey(row);
    const existing = bucket.metrics[key] ?? {
      n: 0,
      sumX: 0,
      sumY: 0,
      sumXX: 0,
      sumYY: 0,
      sumXY: 0,
    };
    existing.n += row.n;
    existing.sumX += row.sumX;
    existing.sumY += row.sumY;
    existing.sumXX += row.sumXX;
    existing.sumYY += row.sumYY;
    existing.sumXY += row.sumXY;
    bucket.metrics[key] = existing;

    buckets.set(row.bucketStart, bucket);
  }

  return Array.from(buckets.keys())
    .sort()
    .map((start) => {
      const bucket = buckets.get(start)!;
      return {
        start,
        end: bucket.end,
        closed: isClosed(bucket.end, ctx.to, ctx.now),
        sampleSize: bucket.sampleSize,
        metrics: bucket.metrics,
      };
    });
}

/**
 * The mean offset from the target's centroid, the population spread, and the
 * bearing of that offset — derived isomorphically against `zoneCentroid` so
 * SQL never holds an aim point (phase-2 decision 3). `null` when there is
 * nothing to summarize: fewer than two darts, or the target has no single
 * centre.
 */
export function groupingSummary(
  m: GroupingMoment,
  target: { number: number; zone: IntentZoneKey },
): {
  n: number;
  meanOffset: BoardPoint;
  spreadMm: number;
  bearingDegrees: number;
} | null {
  if (m.n < 2) return null;
  const centroid = zoneCentroid(target.number, target.zone);
  if (centroid === null) return null;

  const meanX = m.sumX / m.n;
  const meanY = m.sumY / m.n;
  const varX = m.sumXX / m.n - meanX * meanX;
  const varY = m.sumYY / m.n - meanY * meanY;
  const dx = meanX - centroid.x;
  const dy = meanY - centroid.y;

  return {
    n: m.n,
    meanOffset: { x: dx, y: dy },
    spreadMm: Math.sqrt(varX + varY),
    bearingDegrees: (Math.atan2(dx, -dy) * (180 / Math.PI) + 360) % 360,
  };
}
