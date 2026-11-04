import { bucketFor, closeBuckets } from "./series.module";
import type {
  ContextSplit,
  StatsBucketRow,
  VolumeMetrics,
} from "@modules/types";
import type { SeriesBucket } from "@lib/types";

function emptySplit(): ContextSplit {
  return { standalone: 0, routine: 0 };
}

/** Folds `findBucketedSessionAggregates` rows into `volume` buckets, split by play context (`00-Overview.md` §8). */
export function volumeBuckets(
  rows: readonly StatsBucketRow[],
  ctx: { to: string; now: Date },
): SeriesBucket<VolumeMetrics>[] {
  const buckets = new Map<
    string,
    { end: string; metrics: VolumeMetrics; sampleSize: number }
  >();

  for (const row of rows) {
    const bucket = bucketFor(buckets, row, () => ({
      sessions: emptySplit(),
      darts: emptySplit(),
      durationSeconds: emptySplit(),
    }));
    const key = row.contextKey === "ROUTINE" ? "routine" : "standalone";
    bucket.sampleSize += row.sessions;
    bucket.metrics.sessions[key] += row.sessions;
    bucket.metrics.darts[key] += row.dartSum;
    bucket.metrics.durationSeconds[key] += row.durationSum;
  }

  return closeBuckets(buckets, ctx);
}
