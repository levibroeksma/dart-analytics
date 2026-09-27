import { configGroupKey } from "@lib/stats/config-group";
import { aroundTheClockAimKey } from "../derived-aims.module";
import { snapshotOf } from "../x01-checkout-sessions.module";
import { isClosed } from "./series.module";
import type { AroundTheClockEngineConfig, SeriesBucket } from "@lib/types";
import type {
  AroundTheClockSeatState,
  AtcDartsPerTargetMetrics,
  SeatFoldStep,
  SessionSteps,
} from "@modules/types";

/**
 * `atc-darts-per-target`'s grouping fields (phase-4 decision 13), mirroring
 * `section-registry.ts`'s `configSensitive` for this section.
 */
const CONFIG_SENSITIVE = [
  "ruleset_version_key",
  "difficulty",
  "segment_rule",
] as const;

type TargetMetrics = Record<string, { darts: number; cleared: number }>;

/**
 * Folds one session's steps into `group`: a dart counts against the `before`
 * aim, and clears the target when the fold moves past it — the next index, a
 * lap, or `COMPLETE` (phase-4 decision 14). A V2 step-back dart still counts
 * toward `darts`, never `cleared`, since it never advances past its aim.
 */
function foldSessionIntoGroup(
  group: TargetMetrics,
  session: SessionSteps<unknown>,
  config: AroundTheClockEngineConfig,
): void {
  const steps =
    session.steps as readonly SeatFoldStep<AroundTheClockSeatState>[];

  for (const step of steps) {
    const aim = aroundTheClockAimKey(step.before, config);
    const existing = group[aim] ?? { darts: 0, cleared: 0 };
    existing.darts += 1;
    const cleared =
      step.after.targetIndex === step.before.targetIndex + 1 ||
      step.after.laps > step.before.laps ||
      step.after.status === "COMPLETE";
    if (cleared) existing.cleared += 1;
    group[aim] = existing;
  }
}

type BucketAccumulator = {
  end: string;
  metrics: AtcDartsPerTargetMetrics;
  sampleSize: number;
};

/**
 * Folds Around the Clock sessions into `atc-darts-per-target` buckets
 * (phase-4 decision 14), grouped per config (decision 13). A session whose
 * snapshot no longer decodes contributes nothing here — it was already
 * skipped once, upstream, by `sessionSteps`' own skip rule; this is only a
 * second, defensive read of the same snapshot. `sampleSize` is the number of
 * sessions folded; a bucket with none is not emitted.
 */
export function atcDartsPerTargetBuckets(
  sessions: readonly SessionSteps<unknown>[],
  ctx: { to: string; now: Date },
): SeriesBucket<AtcDartsPerTargetMetrics>[] {
  const buckets = new Map<string, BucketAccumulator>();

  for (const session of sessions) {
    const config = snapshotOf(session.rulesetVersionKey, session.configuration);
    if (config === null) continue;

    const bucket = buckets.get(session.bucketStart) ?? {
      end: session.bucketEnd,
      metrics: {},
      sampleSize: 0,
    };

    const groupKey = configGroupKey(CONFIG_SENSITIVE, session);
    const group = bucket.metrics[groupKey] ?? {};
    foldSessionIntoGroup(group, session, config as AroundTheClockEngineConfig);
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
