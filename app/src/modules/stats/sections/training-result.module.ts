import { configGroupKey } from "@lib/stats/config-group";
import { isClosed } from "./series.module";
import type { SeriesBucket } from "@lib/types";
import type {
  DoublesTrainingSeatState,
  SeatFoldStep,
  SessionSteps,
  SinglesTrainingSeatState,
  TrainingResultMetrics,
} from "@modules/types";

/**
 * `training-result`'s grouping fields (#738), mirroring `section-registry.ts`'s
 * `configSensitive` for this section. Doubles Training has neither
 * `difficulty` nor `scoring_mode`, so both render empty for it and its
 * groups split on ruleset version alone.
 */
const CONFIG_SENSITIVE = [
  "ruleset_version_key",
  "difficulty",
  "scoring_mode",
] as const;

type BucketAccumulator = {
  end: string;
  metrics: TrainingResultMetrics;
  sampleSize: number;
};

/**
 * One session's headline, read off the fold's last step (#738): the seat's
 * running `totalPoints` for Singles Training, the count of hit visits in
 * `outcomes` for Doubles Training. `null` for a session with no steps or any
 * other game — never a guessed zero.
 */
function headlineOf(session: SessionSteps<unknown>): number | null {
  const last = session.steps.at(-1);
  if (!last) return null;
  if (session.rulesetVersionKey.startsWith("SINGLES_")) {
    return (last as SeatFoldStep<SinglesTrainingSeatState>).after.totalPoints;
  }
  if (session.rulesetVersionKey.startsWith("DOUBLES_TRAINING_")) {
    return (
      last as SeatFoldStep<DoublesTrainingSeatState>
    ).after.outcomes.filter((outcome) => outcome.hit).length;
  }
  return null;
}

/**
 * Folds Singles and Doubles Training sessions into `training-result` buckets
 * (#738), grouped per config so Hard/Extreme or Accuracy runs never blend
 * with plain ones. `sampleSize` is the number of sessions folded; a bucket
 * with none is not emitted.
 */
export function trainingResultBuckets(
  sessions: readonly SessionSteps<unknown>[],
  ctx: { to: string; now: Date },
): SeriesBucket<TrainingResultMetrics>[] {
  const buckets = new Map<string, BucketAccumulator>();

  for (const session of sessions) {
    const headline = headlineOf(session);
    if (headline === null) continue;

    const bucket = buckets.get(session.bucketStart) ?? {
      end: session.bucketEnd,
      metrics: {},
      sampleSize: 0,
    };

    const groupKey = configGroupKey(CONFIG_SENSITIVE, session);
    const group = bucket.metrics[groupKey] ?? {
      sessions: 0,
      total: 0,
      best: headline,
    };
    group.sessions += 1;
    group.total += headline;
    group.best = Math.max(group.best, headline);
    bucket.metrics[groupKey] = group;
    bucket.sampleSize += 1;

    buckets.set(session.bucketStart, bucket);
  }

  return Array.from(buckets.entries())
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([start, bucket]) => ({
      start,
      end: bucket.end,
      closed: isClosed(bucket.end, ctx.to, ctx.now),
      sampleSize: bucket.sampleSize,
      metrics: bucket.metrics,
    }));
}
