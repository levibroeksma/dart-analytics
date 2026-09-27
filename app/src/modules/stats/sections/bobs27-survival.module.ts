import { configGroupKey } from "@lib/stats/config-group";
import { formatTargetKey } from "@lib/stats/target-key";
import { doublesPath, targetAt } from "@modules/game/board-progression.module";
import { doubleTargetIntent } from "@modules/game/turn-log.module";
import { isClosed } from "./series.module";
import type { IntentZoneKey, SeriesBucket, TargetKey } from "@lib/types";
import type {
  Bobs27SeatState,
  Bobs27SurvivalGroupMetrics,
  Bobs27SurvivalMetrics,
  SeatFoldStep,
  SessionSteps,
} from "@modules/types";

/**
 * `bobs27-survival`'s grouping fields (phase-4 decision 13), mirroring
 * `section-registry.ts`'s `configSensitive` for this section.
 */
const CONFIG_SENSITIVE = [
  "ruleset_version_key",
  "start_score",
  "miss_penalty_multiplier",
  "bull_hit_value",
] as const;

/**
 * The aim key at one path index, in Bob's 27's own stored-intent convention
 * (`doubleTargetIntent`, `turn-log.module.ts`): `DOUBLE:n`, or `INNER_BULL:25`
 * for the path's last (BULL) target.
 */
function targetKeyAt(index: number): TargetKey {
  const target = targetAt(doublesPath(), index);
  const intent = doubleTargetIntent(target);
  if (intent.intendedTargetNumber === null) {
    throw new Error("doubleTargetIntent never returns a null target number");
  }
  return formatTargetKey(
    intent.intendedTargetNumber,
    intent.intendedZoneKey as IntentZoneKey,
  );
}

function emptyGroup(): Bobs27SurvivalGroupMetrics {
  return { runs: 0, completed: 0, reached: {}, died: {}, scoreAfter: {} };
}

/**
 * Folds one session's resolved visits into `group` (phase-4 decision 15): a
 * visit resolves on the step whose `after.dartsThisVisit` has just emptied
 * back to zero, at the target `before.targetIndex` names. `completed` reads
 * the session's own terminal state off its last step's `after`, never every
 * step.
 */
function foldSessionIntoGroup(
  group: Bobs27SurvivalGroupMetrics,
  session: SessionSteps<unknown>,
): void {
  const steps = session.steps as readonly SeatFoldStep<Bobs27SeatState>[];
  group.runs += 1;

  const last = steps.at(-1);
  if (last && last.after.status === "WON") group.completed += 1;

  for (const step of steps) {
    if (step.after.dartsThisVisit.length !== 0) continue;

    const key = targetKeyAt(step.before.targetIndex);
    group.reached[key] = (group.reached[key] ?? 0) + 1;

    const score = step.after.score;
    const scoreAfter = group.scoreAfter[key] ?? {
      runs: 0,
      sum: 0,
      min: score,
      max: score,
    };
    scoreAfter.runs += 1;
    scoreAfter.sum += score;
    scoreAfter.min = Math.min(scoreAfter.min, score);
    scoreAfter.max = Math.max(scoreAfter.max, score);
    group.scoreAfter[key] = scoreAfter;

    if (step.after.status === "LOST") {
      group.died[key] = (group.died[key] ?? 0) + 1;
    }
  }
}

type BucketAccumulator = {
  end: string;
  metrics: Bobs27SurvivalMetrics;
  sampleSize: number;
};

/**
 * Folds Bob's 27 sessions into `bobs27-survival` buckets (phase-4 decision
 * 15), grouped per config (decision 13). `sampleSize` is the number of
 * sessions folded; a bucket with none is not emitted.
 */
export function bobs27SurvivalBuckets(
  sessions: readonly SessionSteps<unknown>[],
  ctx: { to: string; now: Date },
): SeriesBucket<Bobs27SurvivalMetrics>[] {
  const buckets = new Map<string, BucketAccumulator>();

  for (const session of sessions) {
    const bucket = buckets.get(session.bucketStart) ?? {
      end: session.bucketEnd,
      metrics: {},
      sampleSize: 0,
    };

    const groupKey = configGroupKey(CONFIG_SENSITIVE, session);
    const group = bucket.metrics[groupKey] ?? emptyGroup();
    foldSessionIntoGroup(group, session);
    bucket.metrics[groupKey] = group;
    bucket.sampleSize += 1;

    buckets.set(session.bucketStart, bucket);
  }

  return Array.from(buckets.entries())
    .filter(([, bucket]) => bucket.sampleSize > 0)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([start, bucket]) => ({
      start,
      end: bucket.end,
      closed: isClosed(bucket.end, ctx.to, ctx.now),
      sampleSize: bucket.sampleSize,
      metrics: bucket.metrics,
    }));
}
