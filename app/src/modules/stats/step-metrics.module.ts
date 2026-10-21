import type { EngineFacts } from "@modules/types";
import type {
  DartExerciseKind,
  StepMetricSpec,
  StepResultMetric,
} from "./types";

/**
 * Each dart exercise kind's step-metric contract (D372 decision 7), read
 * from the same engine state `routine-summary.module.ts`'s `summarise*`
 * functions read, so the routine summary modal and the `/statistics`
 * Routines tab can never disagree.
 */
export const STEP_METRIC_SPECS: Readonly<
  Record<DartExerciseKind, StepMetricSpec>
> = {
  "SWITCHING:STANDARD": {
    metrics: { points: "sum", darts: "sum", hits: "sum" },
    headline: "points",
    direction: "higher",
    rates: [["hits", "darts"]],
  },
  "SWITCHING:CHAIN": {
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
  CHECKOUT_SEQUENCE: {
    metrics: { points: "sum", checkouts: "sum", attempts: "sum", darts: "sum" },
    headline: "points",
    direction: "higher",
    rates: [["checkouts", "attempts"]],
  },
  RANDOM_CHECKOUT: {
    metrics: { checkouts: "sum", attempts: "sum", darts: "sum" },
    headline: "checkouts",
    direction: "higher",
    rates: [["checkouts", "attempts"]],
  },
  HIT_COUNT: {
    metrics: { hits: "sum", darts: "sum" },
    headline: "hits",
    direction: "higher",
    rates: [["hits", "darts"]],
  },
  SWITCHBLADE: {
    metrics: { points: "sum", darts: "sum", hits: "sum" },
    headline: "points",
    direction: "higher",
    rates: [["hits", "darts"]],
  },
  DOUBLES_LOCK: {
    metrics: { bonus: "sum", locks: "sum", darts: "sum", hits: "sum" },
    headline: "bonus",
    direction: "higher",
    rates: [["hits", "darts"]],
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
 * Switching Standard scores a dart by the ring it hit relative to its own
 * visit's target, so a non-hit dart can still score under a lenient scoring
 * config (`docs/game-rules/training/exercises/switching.md`). The hit count
 * the summary modal shows is therefore not `state.totalPoints` but a replay
 * of every dart's own intended/hit pair. Chain has no such gap — it counts
 * its own hits — so only Standard reads `facts`.
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
 * Each kind's metric → engine-state field. Switching Standard is absent: its
 * hits replay the darts' own intended/hit pair (`switchingHits`).
 */
const STATE_FIELDS: Readonly<
  Record<
    Exclude<DartExerciseKind, "SWITCHING:STANDARD">,
    Readonly<Record<string, string>>
  >
> = {
  "SWITCHING:CHAIN": {
    bestChain: "bestChain",
    sequences: "completedSequences",
    darts: "dartsThrown",
    hits: "hits",
  },
  DOUBLE_PATTERN: { hits: "totalPoints", darts: "dartsThrown" },
  TARGET_SCORING: {
    bestChain: "bestChain",
    darts: "dartsThrown",
    hits: "hits",
  },
  SCORE_THRESHOLD: { beats: "beats", visits: "visits", darts: "dartsThrown" },
  BULLSEYE_CHECKOUT: {
    checkouts: "checkouts",
    visits: "visits",
    darts: "dartsThrown",
  },
  BULL_UP: { throws: "throws", bullseyes: "bullseyes", bulls: "bulls" },
  CHECKOUT_SEQUENCE: {
    points: "points",
    checkouts: "checkouts",
    attempts: "attempts",
    darts: "dartsThrown",
  },
  RANDOM_CHECKOUT: {
    checkouts: "checkouts",
    attempts: "attempts",
    darts: "dartsThrown",
  },
  HIT_COUNT: { hits: "hits", darts: "dartsThrown" },
  SWITCHBLADE: { points: "total", darts: "dartsThrown", hits: "hits" },
  DOUBLES_LOCK: {
    bonus: "bonus",
    locks: "locks",
    darts: "dartsThrown",
    hits: "hits",
  },
};

/**
 * One definition of each dart exercise kind's step metrics (D372 decision
 * 7), read from its engine state exactly as `routine-summary.module.ts`
 * reads it. Returns exactly the keys `STEP_METRIC_SPECS[kind].metrics`
 * declares.
 */
export function stepMetrics(
  kind: DartExerciseKind,
  state: unknown,
  facts: EngineFacts,
): Record<string, number> {
  if (kind === "SWITCHING:STANDARD")
    return {
      points: numberField(state, "totalPoints", kind),
      darts: numberField(state, "dartsThrown", kind),
      hits: switchingHits(facts),
    };
  return Object.fromEntries(
    Object.entries(STATE_FIELDS[kind]).map(([metric, field]) => [
      metric,
      numberField(state, field, kind),
    ]),
  );
}

/**
 * Merges two buckets' worth of one kind's step metrics per its own spec —
 * `"sum"` keys add, `"max"` keys take the larger — the same re-aggregation
 * rule `step-result` applies across chunk windows.
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
 * Merges two `step-result` results across chunk windows (the client cache
 * wires this in): `metrics` via `mergeStepMetrics`,
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
