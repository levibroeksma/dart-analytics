import { activeNumberOf } from "@modules/game/shanghai.engine.module";
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
 * The active number a session's fold reached a Shanghai on, or `null` when it
 * never did (phase-4 decision 12): the engine's own `SHANGHAI` seat status,
 * read off the same fold every derived-intent section walks — never a copy of
 * the S+D+T rule. Equals the round for a 1–20 session, so the histogram stays
 * comparable across ruleset versions.
 */
function shanghaiNumberOf(session: SessionSteps<unknown>): number | null {
  const steps = session.steps as readonly SeatFoldStep<ShanghaiSeatState>[];
  const shanghaiStep = steps.find((step) => step.after.status === "SHANGHAI");
  return shanghaiStep ? activeNumberOf(shanghaiStep.before) : null;
}

/**
 * Whether a session could have ended on a Shanghai: a Score-only session
 * (`instantWin` off) never can, so counting it would deflate the rate.
 */
function canShanghai(session: SessionSteps<unknown>): boolean {
  const steps = session.steps as readonly SeatFoldStep<ShanghaiSeatState>[];
  return steps[0]?.before.instantWin ?? true;
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
    if (!canShanghai(session)) continue;
    const bucket = buckets.get(session.bucketStart) ?? {
      end: session.bucketEnd,
      metrics: { sessions: 0, shanghais: 0, byRound: {} },
      sampleSize: 0,
    };

    bucket.metrics.sessions += 1;
    bucket.sampleSize += 1;

    const landedOn = shanghaiNumberOf(session);
    if (landedOn !== null) {
      bucket.metrics.shanghais += 1;
      const key = String(landedOn);
      bucket.metrics.byRound[key] = (bucket.metrics.byRound[key] ?? 0) + 1;
    }

    buckets.set(session.bucketStart, bucket);
  }

  return closeBuckets(buckets, ctx, { dropEmpty: true });
}
