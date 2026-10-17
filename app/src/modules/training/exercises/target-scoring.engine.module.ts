import type { TargetScoringConfigData } from "@lib/types";
import { TargetScoringV1Config } from "@lib/training/exercises/rulesets/types";
import type {
  BoardTarget,
  ChainTrackExt,
  DartFact,
  DartIntent,
  DartObservation,
  EngineFacts,
  TrackSeat,
} from "@modules/types";
import type { TrackRules } from "@modules/interfaces";
import {
  BULL_TARGET_NUMBER,
  numbersPath,
} from "@modules/game/board-progression.module";
import {
  foldTrackDarts,
  initialTrackSeat,
} from "@modules/game/track-kernel.module";
import {
  chainOnTarget,
  closeAfter,
  pathTarget,
  sectionOf,
} from "@modules/game/track-policies";
import { registerDartExerciseEngineFactory } from "./dart-engine.registry";
import {
  dartExerciseEngineClass,
  dartExerciseEngineFactory,
} from "./dart-exercise-shell.module";
import type { DartExerciseSpec } from "./interfaces";
import { SOLO_PARTICIPANT_REF } from "./solo-participant.module";
import type { TargetScoringState } from "./types";

const EXERCISE_RULESET_VERSION_KEY = "TARGET_SCORING_V1" as const;
const DARTS_PER_VISIT = 3;
const DONE_MESSAGE =
  "A Target Scoring seat never finishes; only the timer ends the exercise.";
const SOLO_SEAT = {
  participantRef: SOLO_PARTICIPANT_REF,
  sideKey: SOLO_PARTICIPANT_REF,
};

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

/**
 * Target Scoring's Track rules: the config's targets in order; a dart hits
 * when `targetScoringPoints` scores it and adds those points; `chainOnTarget`
 * builds the chain and cycles to the next target on a miss that ends one.
 * Visits close after three darts and carry no rule of their own.
 */
function targetScoringRules(
  config: TargetScoringConfigData,
): TrackRules<ChainTrackExt> {
  const pointsOn = (target: BoardTarget, observation: DartObservation) =>
    targetScoringPoints(sectionOf(target), observation);
  return {
    doneMessage: DONE_MESSAGE,
    target: pathTarget(numbersPath(config.targets)),
    hit: (target, observation) => pointsOn(target, observation) !== null,
    points: (target, observation) => pointsOn(target, observation) ?? 0,
    onDart: chainOnTarget(config.targets.length),
    visitOpen: closeAfter(DARTS_PER_VISIT),
  };
}

function initialSeat(
  config: TargetScoringConfigData,
): TrackSeat<ChainTrackExt> {
  return initialTrackSeat(SOLO_SEAT, {
    chain: 0,
    finishedBest: config.targets.map(() => null),
    hits: 0,
  });
}

/**
 * Folds the whole fact log into Target Scoring state — a pure function of
 * `facts`/`config`/`complete`, folded through the Track kernel's `foldTrackDarts`. Darts are
 * replayed in write order, which is what reproduces each dart's target.
 */
export function foldTargetScoringState(
  facts: EngineFacts,
  config: TargetScoringConfigData,
  complete: boolean,
): TargetScoringState {
  const seat = foldTrackDarts(
    facts.turns,
    initialSeat(config),
    targetScoringRules(config),
  );
  const { chain, finishedBest, hits } = seat.ext;
  const bestChainByTarget = config.targets.map((targetNumber, index) => ({
    targetNumber,
    bestChain: Math.max(
      finishedBest[index] ?? 0,
      index === seat.targetIndex ? chain : 0,
    ),
  }));

  return {
    currentTargetNumber: config.targets[seat.targetIndex],
    targetIndex: seat.targetIndex,
    currentChain: chain,
    bestChain: Math.max(
      0,
      ...bestChainByTarget.map((entry) => entry.bestChain),
    ),
    markToBeat: finishedBest[seat.targetIndex],
    bestChainByTarget,
    hits,
    dartsThrown: facts.turns.reduce(
      (count, turn) => count + turn.darts.length,
      0,
    ),
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
