import type { DoublePatternConfigData } from "@lib/types";
import { DoublePatternV1Config } from "@lib/training/exercises/rulesets/types";
import type { DartFact, EngineFacts } from "@modules/types";
import type { DartExerciseSpec } from "@modules/interfaces";
import {
  dartExerciseEngineClass,
  registerDartExercise,
} from "./dart-exercise-shell.module";
import type { DoublePatternState } from "./types";

const EXERCISE_RULESET_VERSION_KEY = "DOUBLE_PATTERN_V1" as const;

type PatternPosition = { patternIndex: number; targetWithinPattern: number };

/**
 * Where `dartsThrown` (0-indexed count of darts already thrown, i.e. the
 * position of the *next* dart) falls in the flattened, repeating sequence
 * of `patterns`. `patterns` is non-empty and every pattern has at least one
 * element (`DoublePatternV1Config`), so `cycleLength` is always positive and
 * the loop always finds a position.
 */
function positionFor(
  patterns: readonly number[][],
  dartsThrown: number,
): PatternPosition {
  const cycleLength = patterns.reduce((sum, p) => sum + p.length, 0);
  let offset = dartsThrown % cycleLength;
  for (let patternIndex = 0; patternIndex < patterns.length; patternIndex++) {
    const length = patterns[patternIndex].length;
    if (offset < length) return { patternIndex, targetWithinPattern: offset };
    offset -= length;
  }
  throw new Error("unreachable");
}

type DoublePatternProgress = {
  dartsThrown: number;
  totalPoints: number;
};

const INITIAL_PROGRESS: DoublePatternProgress = {
  dartsThrown: 0,
  totalPoints: 0,
};

/**
 * Pure reducer: folds one dart fact onto the running Double Pattern
 * progress. Exported for direct unit testing independent of the engine
 * class.
 */
export function applyDoublePatternDart(
  config: DoublePatternConfigData,
  progress: DoublePatternProgress,
  dart: Pick<DartFact, "hitTargetNumber" | "hitZoneKey">,
): DoublePatternProgress {
  const { patternIndex, targetWithinPattern } = positionFor(
    config.patterns,
    progress.dartsThrown,
  );
  const intendedDouble = config.patterns[patternIndex][targetWithinPattern];
  const hit =
    dart.hitTargetNumber === intendedDouble && dart.hitZoneKey === "DOUBLE";
  return {
    dartsThrown: progress.dartsThrown + 1,
    totalPoints: progress.totalPoints + (hit ? 1 : 0),
  };
}

/**
 * Folds the whole fact log into Double Pattern state — a pure function of
 * `facts`/`config`/`complete`, mirroring `foldSwitchingState`.
 */
export function foldDoublePatternState(
  facts: EngineFacts,
  config: DoublePatternConfigData,
  complete: boolean,
): DoublePatternState {
  const progress = facts.turns
    .flatMap((turn) => turn.darts)
    .reduce(
      (acc, dart) => applyDoublePatternDart(config, acc, dart),
      INITIAL_PROGRESS,
    );
  const { patternIndex, targetWithinPattern } = positionFor(
    config.patterns,
    progress.dartsThrown,
  );

  return {
    patternIndex,
    targetWithinPattern,
    currentDoubleNumber: config.patterns[patternIndex][targetWithinPattern],
    totalPoints: progress.totalPoints,
    dartsThrown: progress.dartsThrown,
    status: complete ? "COMPLETE" : "IN_PROGRESS",
  };
}

/**
 * Each visit is one pattern, so a visit closes once the next dart starts a
 * pattern; a closed visit is never reused.
 */
const doublePatternSpec: DartExerciseSpec<
  DoublePatternConfigData,
  DoublePatternState
> = {
  exerciseRulesetVersionKey: EXERCISE_RULESET_VERSION_KEY,
  parse: (config) => DoublePatternV1Config.parse(config),
  fold: foldDoublePatternState,
  intent: (state) => ({
    intendedTargetNumber: state.currentDoubleNumber,
    intendedZoneKey: "DOUBLE",
  }),
  isVisitOpen: (turn, state) =>
    turn.completedAt === null && state.targetWithinPattern !== 0,
};

/**
 * Double Pattern: cycles a fixed list of double-number patterns, one visit
 * per pattern — each visit throws as many darts as its own pattern has
 * entries (09-Training/01-Routines.md §17, design spec 2026-09-11 §5.3). Every
 * hit double scores 1 point; nothing else scores. On the exercise shell:
 * completion arrives only through `expireTimer()` (D264).
 */
export class DoublePatternEngine extends dartExerciseEngineClass(
  doublePatternSpec,
) {}

export const doublePatternEngineFactory = registerDartExercise(
  doublePatternSpec,
  DoublePatternEngine,
).factory;
