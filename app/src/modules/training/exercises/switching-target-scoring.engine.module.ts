import type { SwitchingTargetScoringConfigData } from "@lib/types";
import { SwitchingTargetScoringV1Config } from "@lib/training/exercises/rulesets/types";
import type {
  BoardTarget,
  DartObservation,
  EngineFacts,
  SequenceTrackExt,
  TrackSeat,
} from "@modules/types";
import type { TrackRules } from "@modules/interfaces";
import { numbersPath } from "@modules/game/board-progression.module";
import {
  foldTrackDarts,
  initialTrackSeat,
} from "@modules/game/track-kernel.module";
import {
  closeAfter,
  pathTarget,
  resetOnMiss,
  sectionOf,
} from "@modules/game/track-policies";
import { registerDartExerciseEngineFactory } from "./dart-engine.registry";
import {
  dartExerciseEngineClass,
  dartExerciseEngineFactory,
} from "./dart-exercise-shell.module";
import type { DartExerciseSpec } from "./interfaces";
import { SOLO_PARTICIPANT_REF } from "./solo-participant.module";
import {
  targetScoringIntent,
  targetScoringPoints,
} from "./target-scoring.engine.module";
import type { SwitchingTargetScoringState } from "./types";

const EXERCISE_RULESET_VERSION_KEY = "SWITCHING_TARGET_SCORING_V1" as const;
const DARTS_PER_VISIT = 3;
const DONE_MESSAGE =
  "A Switching Target Scoring seat never finishes; only the timer ends the exercise.";
const SOLO_SEAT = {
  participantRef: SOLO_PARTICIPANT_REF,
  sideKey: SOLO_PARTICIPANT_REF,
};

/**
 * Switching Target Scoring's Track rules: the config's three targets in
 * order, scored as Target Scoring; `resetOnMiss` advances on a hit, wrapping
 * after the last, and restarts the sequence on a miss. Visits close after
 * three darts and carry no rule of their own.
 */
function switchingTargetScoringRules(
  config: SwitchingTargetScoringConfigData,
): TrackRules<SequenceTrackExt> {
  const pointsOn = (target: BoardTarget, observation: DartObservation) =>
    targetScoringPoints(sectionOf(target), observation);
  return {
    doneMessage: DONE_MESSAGE,
    target: pathTarget(numbersPath(config.targets)),
    hit: (target, observation) => pointsOn(target, observation) !== null,
    points: (target, observation) => pointsOn(target, observation) ?? 0,
    onDart: resetOnMiss(config.targets.length),
    visitOpen: closeAfter(DARTS_PER_VISIT),
  };
}

function initialSeat(): TrackSeat<SequenceTrackExt> {
  return initialTrackSeat(SOLO_SEAT, {
    chain: 0,
    finishedBest: null,
    hits: 0,
    sequences: 0,
  });
}

/**
 * Folds the whole fact log into Switching Target Scoring state — a pure
 * function of `facts`/`config`/`complete`, folded through the Track kernel's
 * `foldTrackDarts`. Darts are replayed in write order, which is what
 * reproduces each dart's target.
 */
export function foldSwitchingTargetScoringState(
  facts: EngineFacts,
  config: SwitchingTargetScoringConfigData,
  complete: boolean,
): SwitchingTargetScoringState {
  const seat = foldTrackDarts(
    facts.turns,
    initialSeat(),
    switchingTargetScoringRules(config),
  );
  const { chain, finishedBest, hits, sequences } = seat.ext;

  return {
    currentTargetNumber: config.targets[seat.targetIndex],
    targetIndex: seat.targetIndex,
    currentChain: chain,
    bestChain: Math.max(finishedBest ?? 0, chain),
    markToBeat: finishedBest,
    completedSequences: sequences,
    hits,
    dartsThrown: facts.turns.reduce(
      (count, turn) => count + turn.darts.length,
      0,
    ),
    status: complete ? "COMPLETE" : "IN_PROGRESS",
  };
}

/**
 * Switching Target Scoring's rules for the exercise shell: Target Scoring's
 * points on a three-target sequence — a hit advances, a miss resets the chain
 * and restarts the sequence
 * (`docs/game-rules/training/exercises/switching-target-scoring.md`). One
 * three-dart visit per `TurnFact`; the sequence carries across visits.
 */
const switchingTargetScoringSpec: DartExerciseSpec<
  SwitchingTargetScoringConfigData,
  SwitchingTargetScoringState
> = {
  exerciseRulesetVersionKey: EXERCISE_RULESET_VERSION_KEY,
  parse: (config) => SwitchingTargetScoringV1Config.parse(config),
  fold: foldSwitchingTargetScoringState,
  intent: (state) => targetScoringIntent(state.currentTargetNumber),
  isVisitOpen: (turn) => turn.darts.length < DARTS_PER_VISIT,
};

/** Switching Target Scoring exercise engine (D264), built by the exercise shell. */
export class SwitchingTargetScoringEngine extends dartExerciseEngineClass(
  switchingTargetScoringSpec,
) {}

export const switchingTargetScoringEngineFactory = dartExerciseEngineFactory(
  switchingTargetScoringSpec,
  SwitchingTargetScoringEngine,
);

registerDartExerciseEngineFactory(switchingTargetScoringEngineFactory);
