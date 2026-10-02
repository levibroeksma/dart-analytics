import { isClosed } from "./series.module";
import type {
  SessionBestAverage,
  SessionResultMetrics,
  StatsBucketRow,
} from "@modules/types";
import type { SeriesBucket } from "@lib/types";

function bestAverageOf(row: StatsBucketRow): SessionBestAverage | null {
  if (
    row.bestAvgSessionId === null ||
    row.bestAvgPoints === null ||
    row.bestAvgDarts === null ||
    row.bestAvgCompletedAt === null ||
    row.bestAvgDarts === 0
  ) {
    return null;
  }
  return {
    sessionId: row.bestAvgSessionId,
    points: row.bestAvgPoints,
    darts: row.bestAvgDarts,
    completedAt: row.bestAvgCompletedAt,
  };
}

/** The higher of two per-session averages; a `null` side never wins. */
function higherAverage(
  a: SessionBestAverage | null,
  b: SessionBestAverage | null,
): SessionBestAverage | null {
  if (a === null) return b;
  if (b === null) return a;
  return b.points / b.darts > a.points / a.darts ? b : a;
}

/**
 * Folds `findBucketedSessionAggregates` rows into `session-result` buckets,
 * keyed by `ruleset_version_key` (D367 decision 3, `configSensitive`).
 * Merging two groups within the same bucket and ruleset version sums the
 * additive components but never averages the extremes: `countedScoreMin`/
 * `Max` and their session ids come from whichever group actually holds
 * that extreme, and `bestAverage` from whichever group's best session has
 * the higher `points / darts` ratio.
 */
export function sessionResultBuckets(
  rows: readonly StatsBucketRow[],
  ctx: { to: string; now: Date },
): SeriesBucket<SessionResultMetrics>[] {
  const buckets = new Map<
    string,
    { end: string; metrics: SessionResultMetrics; sampleSize: number }
  >();

  for (const row of rows) {
    const bucket = buckets.get(row.bucketStart) ?? {
      end: row.bucketEnd,
      metrics: {},
      sampleSize: 0,
    };
    bucket.sampleSize += row.sessions;

    const existing = bucket.metrics[row.rulesetVersionKey];
    if (!existing) {
      bucket.metrics[row.rulesetVersionKey] = {
        sessions: row.sessions,
        countedScoreSum: row.scoreSum,
        dartSum: row.dartSum,
        turnSum: row.turnSum,
        countedScoreMin: row.scoreMin,
        countedScoreMax: row.scoreMax,
        bestLowSessionId: row.minSessionId,
        bestHighSessionId: row.maxSessionId,
        bestAverage: bestAverageOf(row),
      };
    } else {
      existing.sessions += row.sessions;
      existing.countedScoreSum += row.scoreSum;
      existing.dartSum += row.dartSum;
      existing.turnSum += row.turnSum;
      if (row.scoreMin < existing.countedScoreMin) {
        existing.countedScoreMin = row.scoreMin;
        existing.bestLowSessionId = row.minSessionId;
      }
      if (row.scoreMax > existing.countedScoreMax) {
        existing.countedScoreMax = row.scoreMax;
        existing.bestHighSessionId = row.maxSessionId;
      }
      existing.bestAverage = higherAverage(
        existing.bestAverage,
        bestAverageOf(row),
      );
    }
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
