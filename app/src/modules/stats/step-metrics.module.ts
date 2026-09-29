import type { EngineFacts } from "@modules/types";
import type {
  DartExerciseKind,
  StepMetricSpec,
  StepResultMetric,
} from "./types";

/**
 * Each dart exercise kind's step-metric contract (phase 6b plan decision 7),
 * read from the same engine state `routine-summary.module.ts`'s
 * `summarise*` functions read, so the routine summary modal and the future
 * `/statistics` Routines tab can never disagree.
 */
export const STEP_METRIC_SPECS: Readonly<
  Record<DartExerciseKind, StepMetricSpec>
> = {
  SWITCHING: {
    metrics: { points: "sum", darts: "sum", hits: "sum" },
    headline: "points",
    direction: "higher",
    rates: [["hits", "darts"]],
  },
  DOUBLE_PATTERN: {
    metrics: { hits: "sum", darts: "sum" },
    headline: "hits",
    direction: "higher",
    rates: [["hits", "darts"]],
  },
  TARGET_SCORING: {
    metrics: { bestChain: "max", darts: "sum", hits: "sum" },
    headline: "bestChain",
    direction: "higher",
    rates: [["hits", "darts"]],
  },
  SWITCHING_TARGET_SCORING: {
    metrics: {
      bestChain: "max",
      sequences: "sum",
      darts: "sum",
      hits: "sum",
    },
    headline: "bestChain",
    direction: "higher",
    rates: [["hits", "darts"]],
  },
  SCORE_THRESHOLD: {
    metrics: { beats: "sum", visits: "sum", darts: "sum" },
    headline: "beats",
    direction: "higher",
    rates: [["beats", "visits"]],
  },
  BULLSEYE_CHECKOUT: {
    metrics: { checkouts: "sum", visits: "sum", darts: "sum" },
    headline: "checkouts",
    direction: "higher",
    rates: [["checkouts", "visits"]],
  },
  BULL_UP: {
    metrics: { throws: "sum", bullseyes: "sum", bulls: "sum" },
    headline: "bullseyes",
    direction: "higher",
    rates: [
      ["bullseyes", "throws"],
      ["bulls", "throws"],
    ],
  },
};

/**
 * Reads one numeric field off an engine state that arrives as `unknown` —
 * `stepMetrics`'s caller rebuilds it through the type-erased
 * `getDartExerciseEngineFactory` registry, so nothing upstream can promise
 * its shape. A missing or non-numeric field is a contract break between an
 * engine and its `STEP_METRIC_SPECS` entry, never bad session data, so this
 * throws rather than substituting a default.
 */
function numberField(
  state: unknown,
  field: string,
  kind: DartExerciseKind,
): number {
  const value =
    typeof state === "object" && state !== null
      ? (state as Record<string, unknown>)[field]
      : undefined;
  if (typeof value !== "number") {
    throw new Error(
      `stepMetrics(${kind}): state is missing numeric field "${field}"`,
    );
  }
  return value;
}

/**
 * Switching scores a dart by the ring it hit relative to its own visit's
 * target, so a non-hit dart can still score under a lenient scoring config
 * (`docs/game-rules/training/exercises/switching.md`). The hit count the
 * summary modal shows is therefore not `state.totalPoints` but a replay of
 * every dart's own intended/hit pair — the same walk
 * `routine-summary.module.ts`'s `summariseSwitching` used to perform inline.
 */
function switchingHits(facts: EngineFacts): number {
  return facts.turns
    .flatMap((turn) => turn.darts)
    .filter(
      (dart) =>
        dart.intendedTargetNumber !== null &&
        dart.hitTargetNumber === dart.intendedTargetNumber,
    ).length;
}

/**
 * One definition of each dart exercise kind's step metrics (phase 6b plan
 * decision 7), read from its engine state exactly as
 * `routine-summary.module.ts` reads it today. Returns exactly the keys
 * `STEP_METRIC_SPECS[kind].metrics` declares.
 */
export function stepMetrics(
  kind: DartExerciseKind,
  state: unknown,
  facts: EngineFacts,
): Record<string, number> {
  switch (kind) {
    case "SWITCHING":
      return {
        points: numberField(state, "totalPoints", kind),
        darts: numberField(state, "dartsThrown", kind),
        hits: switchingHits(facts),
      };
    case "DOUBLE_PATTERN":
      return {
        hits: numberField(state, "totalPoints", kind),
        darts: numberField(state, "dartsThrown", kind),
      };
    case "TARGET_SCORING":
      return {
        bestChain: numberField(state, "bestChain", kind),
        darts: numberField(state, "dartsThrown", kind),
        hits: numberField(state, "hits", kind),
      };
    case "SWITCHING_TARGET_SCORING":
      return {
        bestChain: numberField(state, "bestChain", kind),
        sequences: numberField(state, "completedSequences", kind),
        darts: numberField(state, "dartsThrown", kind),
        hits: numberField(state, "hits", kind),
      };
    case "SCORE_THRESHOLD":
      return {
        beats: numberField(state, "beats", kind),
        visits: numberField(state, "visits", kind),
        darts: numberField(state, "dartsThrown", kind),
      };
    case "BULLSEYE_CHECKOUT":
      return {
        checkouts: numberField(state, "checkouts", kind),
        visits: numberField(state, "visits", kind),
        darts: numberField(state, "dartsThrown", kind),
      };
    case "BULL_UP":
      return {
        throws: numberField(state, "throws", kind),
        bullseyes: numberField(state, "bullseyes", kind),
        bulls: numberField(state, "bulls", kind),
      };
  }
}

/**
 * Merges two buckets' worth of one kind's step metrics per its own spec —
 * `"sum"` keys add, `"max"` keys take the larger — the same re-aggregation
 * rule `step-result` (phase 6b Task 4) applies across chunk windows.
 */
export function mergeStepMetrics(
  spec: StepMetricSpec,
  a: Record<string, number>,
  b: Record<string, number>,
): Record<string, number> {
  const merged: Record<string, number> = {};
  for (const key of Object.keys(spec.metrics)) {
    merged[key] =
      spec.metrics[key] === "max" ? Math.max(a[key], b[key]) : a[key] + b[key];
  }
  return merged;
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

/**
 * Merges two `step-result` results across chunk windows (controller ruling
 * R14; the client cache wires this in): `metrics` via `mergeStepMetrics`,
 * `headlineMin`/`Max` by the tighter/wider extreme with `null` as identity
 * (`null` only when neither side folded a session), `sessions`/
 * `skippedSessions` sum. Lives here, not beside `foldStepResult`, so a
 * client-side cache merge never pulls the engine-registering imports
 * `step-result.module.ts` carries into the bundle.
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
