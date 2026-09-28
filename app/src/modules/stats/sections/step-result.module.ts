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
import type { ExerciseRulesetVersionKey } from "@lib/types";
import type {
  DartExerciseKind,
  EngineFacts,
  ReplayStageRow,
  StepFoldSession,
  StepMetricSpec,
  StepResultMetric,
} from "@modules/types";

/**
 * Every registered dart exercise kind (`STEP_METRIC_SPECS`) opens exactly
 * one `EXERCISE_BLOCK` stage (`exerciseBlockStage()` in every one of the
 * seven `*.engine.module.ts` files this module imports for registration).
 * `findStepFoldRows` carries no stage-type column (`v_game_replay` is read
 * for its dart/turn columns only), so this synthesizes one root stage per
 * distinct `stageId` a session's rows carry, in the order each first
 * appears, rather than reading a type this fold has no column for.
 */
const SYNTHETIC_STAGE_TYPE_KEY = "EXERCISE_BLOCK";

/** One session's distinct stage ids, in first-appearance order, as synthetic root stages (see `SYNTHETIC_STAGE_TYPE_KEY`). */
function syntheticStages(rows: readonly StepFoldSession[]): ReplayStageRow[] {
  const seen = new Set<string>();
  const stages: ReplayStageRow[] = [];
  for (const row of rows) {
    if (seen.has(row.stageId)) continue;
    seen.add(row.stageId);
    stages.push({
      stageId: row.stageId,
      parentStageId: null,
      stageTypeKey: SYNTHETIC_STAGE_TYPE_KEY,
      sequence: stages.length + 1,
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
 * One session's rebuilt engine state and the facts it was folded from
 * (decision 8), or `null` when the session's `exerciseRulesetVersionKey`
 * names no registered factory or the factory throws building it.
 */
function foldOneSession(
  rows: readonly StepFoldSession[],
): { state: unknown; facts: EngineFacts } | null {
  const first = rows[0]!;
  if (first.exerciseRulesetVersionKey === null) return null;
  const factory = getDartExerciseEngineFactory(
    first.exerciseRulesetVersionKey as ExerciseRulesetVersionKey,
  );
  if (!factory) return null;

  const stages = stageOrder(syntheticStages(rows));
  const turns = rowsToTurns(rows);
  const facts = replayFacts(stages, turns);

  try {
    const state = factory.create(first.configuration, facts).state();
    return { state, facts };
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
 * registered factory or whose engine throws is skipped, counted in
 * `skippedSessions`, never guessed. `headlineMin`/`Max` are the spec's
 * headline metric's extremes across the sessions that did fold.
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
    const result = foldOneSession(rows);
    if (result === null) {
      skipped += 1;
      continue;
    }
    const sessionMetrics = stepMetrics(kind, result.state, result.facts);
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
 * Merges two `step-result` results across chunk windows (controller ruling
 * R14; Task 8 wires this into the client cache): `metrics` via
 * `mergeStepMetrics`, `headlineMin`/`Max` by the tighter/wider extreme with
 * `null` as identity (`null` only when neither side folded a session),
 * `sessions`/`skippedSessions` sum.
 */
export function mergeStepResult(
  spec: StepMetricSpec,
  a: StepResultMetric,
  b: StepResultMetric,
): StepResultMetric {
  return {
    metrics: mergeStepMetrics(spec, a.metrics, b.metrics),
    headlineMin: mergeExtreme(a.headlineMin, b.headlineMin, Math.min),
    headlineMax: mergeExtreme(a.headlineMax, b.headlineMax, Math.max),
    sessions: a.sessions + b.sessions,
    skippedSessions: a.skippedSessions + b.skippedSessions,
  };
}

/** `null` is the identity for either side of an extreme merge — the bucket that folded no session contributes nothing. */
function mergeExtreme(
  a: number | null,
  b: number | null,
  pick: (a: number, b: number) => number,
): number | null {
  if (a === null) return b;
  if (b === null) return a;
  return pick(a, b);
}
