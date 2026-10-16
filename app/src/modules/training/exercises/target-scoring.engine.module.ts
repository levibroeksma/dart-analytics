import type { TargetScoringConfigData } from "@lib/types";
import { TargetScoringV1Config } from "@lib/training/exercises/rulesets/types";
import type { DartFact, DartIntent, EngineFacts } from "@modules/types";
import { BULL_TARGET_NUMBER } from "@modules/game/board-progression.module";
import { registerDartExerciseEngineFactory } from "./dart-engine.registry";
import {
  dartExerciseEngineClass,
  dartExerciseEngineFactory,
} from "./dart-exercise-shell.module";
import type { DartExerciseSpec } from "./interfaces";
import type { TargetScoringState } from "./types";

const EXERCISE_RULESET_VERSION_KEY = "TARGET_SCORING_V1" as const;
const DARTS_PER_VISIT = 3;

const SINGLE_ZONE_KEYS = new Set(["SINGLE", "INNER_SINGLE", "OUTER_SINGLE"]);

/**
 * Exercise points for one dart thrown at `target`, or `null` for a miss
 * (`docs/game-rules/training/exercises/target-scoring.md` §Progress). On a
 * number: either single ring 1, the treble 3, and the double is a miss. On
 * the bull: outer bull 1, bullseye 3. Every hit scores at least 1, so a
 * chain above 0 always holds a hit.
 */
export function targetScoringPoints(
  target: number,
  dart: Pick<DartFact, "hitTargetNumber" | "hitZoneKey">,
): number | null {
  if (dart.hitTargetNumber !== target) return null;
  if (target === BULL_TARGET_NUMBER) {
    if (dart.hitZoneKey === "OUTER_BULL") return 1;
    if (dart.hitZoneKey === "INNER_BULL") return 3;
    return null;
  }
  if (SINGLE_ZONE_KEYS.has(dart.hitZoneKey)) return 1;
  if (dart.hitZoneKey === "TREBLE") return 3;
  return null;
}

/** How a target reads on screen: its number, or `Bull` for 25. */
export function targetScoringTargetLabel(target: number): string {
  return target === BULL_TARGET_NUMBER ? "Bull" : String(target);
}

/**
 * The ring each dart is aimed at: the treble on a number, the bullseye on
 * the bull — the highest-paying ring either way. `darts` needs a zone
 * whenever a target is set (`chk_dart_target_consistency`).
 */
function intentFor(target: number): DartIntent {
  return {
    intendedTargetNumber: target,
    intendedZoneKey: target === BULL_TARGET_NUMBER ? "INNER_BULL" : "TREBLE",
  };
}

type Progress = {
  targetIndex: number;
  currentChain: number;
  bestChain: number;
  /** Best *finished* chain per target index — what `markToBeat` reads. */
  finishedBest: (number | null)[];
  hits: number;
  dartsThrown: number;
};

function initialProgress(config: TargetScoringConfigData): Progress {
  return {
    targetIndex: 0,
    currentChain: 0,
    bestChain: 0,
    finishedBest: config.targets.map(() => null),
    hits: 0,
    dartsThrown: 0,
  };
}

/**
 * Folds one dart onto the running progress. A hit grows the chain; a miss
 * resets it, and advances the target only when the chain it ends held a hit
 * — so a chain always belongs to exactly one target.
 */
function applyDart(
  config: TargetScoringConfigData,
  progress: Progress,
  dart: Pick<DartFact, "hitTargetNumber" | "hitZoneKey">,
): Progress {
  const points = targetScoringPoints(
    config.targets[progress.targetIndex],
    dart,
  );
  const dartsThrown = progress.dartsThrown + 1;
  if (points !== null) {
    const currentChain = progress.currentChain + points;
    return {
      ...progress,
      currentChain,
      bestChain: Math.max(progress.bestChain, currentChain),
      hits: progress.hits + 1,
      dartsThrown,
    };
  }
  if (progress.currentChain === 0) return { ...progress, dartsThrown };

  const finishedBest = [...progress.finishedBest];
  const previous = finishedBest[progress.targetIndex] ?? 0;
  finishedBest[progress.targetIndex] = Math.max(
    previous,
    progress.currentChain,
  );
  return {
    ...progress,
    targetIndex: (progress.targetIndex + 1) % config.targets.length,
    currentChain: 0,
    finishedBest,
    dartsThrown,
  };
}

/**
 * Folds the whole fact log into Target Scoring state — a pure function of
 * `facts`/`config`/`complete`, mirroring `foldSwitchingState`. Darts are
 * replayed in write order, which is what reproduces each dart's target.
 */
export function foldTargetScoringState(
  facts: EngineFacts,
  config: TargetScoringConfigData,
  complete: boolean,
): TargetScoringState {
  const progress = facts.turns
    .flatMap((turn) => turn.darts)
    .reduce(
      (acc, dart) => applyDart(config, acc, dart),
      initialProgress(config),
    );

  return {
    currentTargetNumber: config.targets[progress.targetIndex],
    targetIndex: progress.targetIndex,
    currentChain: progress.currentChain,
    bestChain: progress.bestChain,
    markToBeat: progress.finishedBest[progress.targetIndex],
    bestChainByTarget: config.targets.map((targetNumber, index) => ({
      targetNumber,
      bestChain: Math.max(
        progress.finishedBest[index] ?? 0,
        index === progress.targetIndex ? progress.currentChain : 0,
      ),
    })),
    hits: progress.hits,
    dartsThrown: progress.dartsThrown,
    status: complete ? "COMPLETE" : "IN_PROGRESS",
  };
}

/**
 * Target Scoring's rules for the exercise shell: build the highest chain on
 * the current target before a miss resets it; one three-dart visit per
 * `TurnFact`, each dart carrying its own intended target.
 */
const targetScoringSpec: DartExerciseSpec<
  TargetScoringConfigData,
  TargetScoringState
> = {
  exerciseRulesetVersionKey: EXERCISE_RULESET_VERSION_KEY,
  parse: (config) => TargetScoringV1Config.parse(config),
  fold: foldTargetScoringState,
  intent: (state) => intentFor(state.currentTargetNumber),
  isVisitOpen: (turn) => turn.darts.length < DARTS_PER_VISIT,
};

/** Target Scoring exercise engine (D264), built by the exercise shell. */
export class TargetScoringEngine extends dartExerciseEngineClass(
  targetScoringSpec,
) {}

export const targetScoringEngineFactory = dartExerciseEngineFactory(
  targetScoringSpec,
  TargetScoringEngine,
);

registerDartExerciseEngineFactory(targetScoringEngineFactory);
