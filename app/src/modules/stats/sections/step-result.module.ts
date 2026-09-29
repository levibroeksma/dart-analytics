import "@modules/training/exercises/bull-up.engine.module";
import "@modules/training/exercises/bullseye-checkout.engine.module";
import "@modules/training/exercises/double-pattern.engine.module";
import "@modules/training/exercises/score-threshold.engine.module";
import "@modules/training/exercises/switching-target-scoring.engine.module";
import "@modules/training/exercises/switching.engine.module";
import "@modules/training/exercises/target-scoring.engine.module";
import { getDartExerciseEngineFactory } from "@modules/training/exercises/dart-engine.registry";
import {
  replayFacts,
  rowsToTurns,
  stageOrder,
} from "@modules/stats/replay.module";
import {
  STEP_METRIC_SPECS,
  mergeStepMetrics,
  stepMetrics,
} from "@modules/stats/step-metrics.module";
import { isClosed } from "./series.module";
import type { ExerciseRulesetVersionKey, SeriesBucket } from "@lib/types";
import type {
  DartExerciseKind,
  ReplayStageRow,
  StepFoldBucketRow,
  StepFoldSession,
  StepMetricSpec,
  StepResultMetric,
} from "@modules/types";

/** One session's distinct stages, in first-appearance order, exactly as `v_game_replay` carries them (migration `0044`). */
function stagesOf(rows: readonly StepFoldSession[]): ReplayStageRow[] {
  const seen = new Set<string>();
  const stages: ReplayStageRow[] = [];
  for (const row of rows) {
    if (seen.has(row.stageId)) continue;
    seen.add(row.stageId);
    stages.push({
      stageId: row.stageId,
      parentStageId: row.parentStageId,
      stageTypeKey: row.stageTypeKey,
      sequence: row.stageSequence,
    });
  }
  return stages;
}

/** Groups `sessions` by `sessionId`, preserving each session's own row order (`findStepFoldRows`' own `ORDER BY`). */
function groupBySession(
  sessions: readonly StepFoldSession[],
): Map<string, StepFoldSession[]> {
  const groups = new Map<string, StepFoldSession[]>();
  for (const row of sessions) {
    const group = groups.get(row.sessionId);
    if (group) {
      group.push(row);
    } else {
      groups.set(row.sessionId, [row]);
    }
  }
  return groups;
}

/**
 * One session's own `stepMetrics`, replayed from its rows through its
 * registered engine factory, or `null` when the session's own
 * `exerciseRulesetVersionKey` names no registered factory, the factory
 * throws building the engine (e.g. a stored `configuration` that fails the
 * ruleset's own schema), or `stepMetrics` itself throws (a `kind` whose spec
 * names a field the replayed state does not carry). Every failure mode is
 * a skip, never a guess: the whole rebuild-then-read chain runs inside the
 * one `try`, so a state-shape mismatch discovered only once `stepMetrics`
 * reads the state cannot 500 the rest of the scope.
 */
function foldOneSession(
  kind: DartExerciseKind,
  rows: readonly StepFoldSession[],
): Record<string, number> | null {
  const first = rows[0]!;
  if (first.exerciseRulesetVersionKey === null) return null;
  const factory = getDartExerciseEngineFactory(
    first.exerciseRulesetVersionKey as ExerciseRulesetVersionKey,
  );
  if (!factory) return null;

  try {
    const stages = stageOrder(stagesOf(rows));
    const turns = rowsToTurns(rows);
    const facts = replayFacts(stages, turns);
    const state = factory.create(first.configuration, facts).state();
    return stepMetrics(kind, state, facts);
  } catch {
    return null;
  }
}

/** A fully zeroed metrics object for a spec — the identity `foldStepResult` returns when every session in scope was skipped. */
function zeroMetrics(spec: StepMetricSpec): Record<string, number> {
  const zero: Record<string, number> = {};
  for (const key of Object.keys(spec.metrics)) zero[key] = 0;
  return zero;
}

/**
 * Rebuilds and folds every session of one non-game routine step's dart
 * exercise (phase 6b plan decision 8): groups `sessions`' flat rows by
 * `sessionId`, rebuilds each session's `EngineFacts` (`stageOrder`,
 * `rowsToTurns`, `replayFacts` — phase 5b), replays it through its own
 * registered engine factory, and reads `stepMetrics`. A session with no
 * registered factory, whose engine throws, or whose replayed state does not
 * match `kind`'s own metrics is skipped, counted in `skippedSessions`, never
 * guessed. `headlineMin`/`Max` are the spec's headline metric's extremes
 * across the sessions that did fold.
 */
export function foldStepResult(
  kind: DartExerciseKind,
  sessions: readonly StepFoldSession[],
): StepResultMetric {
  const spec = STEP_METRIC_SPECS[kind];
  let metrics: Record<string, number> | null = null;
  let headlineMin: number | null = null;
  let headlineMax: number | null = null;
  let folded = 0;
  let skipped = 0;

  for (const rows of groupBySession(sessions).values()) {
    const sessionMetrics = foldOneSession(kind, rows);
    if (sessionMetrics === null) {
      skipped += 1;
      continue;
    }
    metrics =
      metrics === null
        ? sessionMetrics
        : mergeStepMetrics(spec, metrics, sessionMetrics);
    const headline = sessionMetrics[spec.headline];
    headlineMin =
      headlineMin === null ? headline : Math.min(headlineMin, headline);
    headlineMax =
      headlineMax === null ? headline : Math.max(headlineMax, headline);
    folded += 1;
  }

  return {
    metrics: metrics ?? zeroMetrics(spec),
    headlineMin,
    headlineMax,
    sessions: folded,
    skippedSessions: skipped,
  };
}

/**
 * Groups `findStepFoldRows`' flat, bucket-tagged rows by the bucket their
 * own session's `completedAt` falls in (controller ruling R15, mirroring
 * `findX01FoldRows`' `bucketStart`/`bucketEnd` precedent), and folds each
 * bucket's own sessions through `foldStepResult`. `sampleSize` is the
 * bucket's own scoped session count — folded plus skipped, since a skip is
 * still a session that happened.
 */
export function stepResultBuckets(
  kind: DartExerciseKind,
  rows: readonly StepFoldBucketRow[],
  ctx: { to: string; now: Date },
): SeriesBucket<StepResultMetric>[] {
  const buckets = new Map<string, { end: string; rows: StepFoldSession[] }>();
  for (const row of rows) {
    const bucket = buckets.get(row.bucketStart) ?? {
      end: row.bucketEnd,
      rows: [],
    };
    bucket.rows.push(row);
    buckets.set(row.bucketStart, bucket);
  }

  return Array.from(buckets.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([start, bucket]) => {
      const result = foldStepResult(kind, bucket.rows);
      return {
        start,
        end: bucket.end,
        closed: isClosed(bucket.end, ctx.to, ctx.now),
        sampleSize: result.sessions + result.skippedSessions,
        metrics: result,
      };
    });
}
