import { closeBuckets } from "./series.module";
import type { SeriesBucket } from "@lib/types";
import type {
  SeatFoldStep,
  SessionSteps,
  ShanghaiCountMetrics,
  ShanghaiSeatState,
} from "@modules/types";

type BucketAccumulator = {
  end: string;
  metrics: ShanghaiCountMetrics;
  sampleSize: number;
};

/**
 * The 1-based round a session's fold reached a Shanghai in, or `null` when it
 * never did (phase-4 decision 12): the engine's own `SHANGHAI` seat status,
 * read off the same fold every derived-intent section walks — never a copy of
 * the S+D+T rule.
 */
function shanghaiRoundOf(session: SessionSteps<unknown>): number | null {
  const steps = session.steps as readonly SeatFoldStep<ShanghaiSeatState>[];
  const shanghaiStep = steps.find((step) => step.after.status === "SHANGHAI");
  return shanghaiStep ? shanghaiStep.before.targetIndex + 1 : null;
}

/**
 * Folds Shanghai sessions into `shanghai-count` buckets (phase-4 decision
 * 12). `sampleSize` is the number of sessions folded; a bucket with none is
 * not emitted.
 */
export function shanghaiCountBuckets(
  sessions: readonly SessionSteps<unknown>[],
  ctx: { to: string; now: Date },
): SeriesBucket<ShanghaiCountMetrics>[] {
  const buckets = new Map<string, BucketAccumulator>();

  for (const session of sessions) {
    const bucket = buckets.get(session.bucketStart) ?? {
      end: session.bucketEnd,
      metrics: { sessions: 0, shanghais: 0, byRound: {} },
      sampleSize: 0,
    };

    bucket.metrics.sessions += 1;
    bucket.sampleSize += 1;

    const round = shanghaiRoundOf(session);
    if (round !== null) {
      bucket.metrics.shanghais += 1;
      const key = String(round);
      bucket.metrics.byRound[key] = (bucket.metrics.byRound[key] ?? 0) + 1;
    }

    buckets.set(session.bucketStart, bucket);
  }

  return closeBuckets(buckets, ctx, { dropEmpty: true });
}
