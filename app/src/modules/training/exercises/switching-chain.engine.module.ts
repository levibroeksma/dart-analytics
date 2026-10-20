import type { SwitchingChainConfigData } from "@lib/types";
import { SwitchingChainV1Config } from "@lib/training/exercises/rulesets/types";
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
import {
  targetScoringIntent,
  targetScoringPoints,
} from "./target-scoring.engine.module";
import { trackExerciseSpec } from "./track-exercise-spec.module";
import type { SwitchingChainState } from "./types";

const EXERCISE_RULESET_VERSION_KEY = "SWITCHING_CHAIN_V1" as const;
const DARTS_PER_VISIT = 3;
const DONE_MESSAGE =
  "A Switching Chain seat never finishes; only the timer ends the exercise.";

/**
 * Switching Chain's Track rules: the config's three targets in order,
 * scored as Target Scoring; `resetOnMiss` advances on a hit, wrapping after
 * the last, and restarts the sequence on a miss. Visits close after three
 * darts and carry no rule of their own.
 */
function switchingChainRules(
  config: SwitchingChainConfigData,
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

function initialExt(): SequenceTrackExt {
  return {
    chain: 0,
    finishedBest: null,
    hits: 0,
    sequences: 0,
  };
}

function projectSwitchingChain(
  seat: TrackSeat<SequenceTrackExt>,
  config: SwitchingChainConfigData,
  complete: boolean,
  facts: EngineFacts,
): SwitchingChainState {
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
 * Switching's Chain config, as its own ruleset version of the `SWITCHING`
 * exercise type: Target Scoring's points on a three-target sequence — a hit
 * advances, a miss resets the chain and restarts the sequence. One
 * three-dart visit per `TurnFact`; the sequence carries across visits. The
 * mode rides on `SWITCHING_CHAIN_V1`, never on the step configuration, so
 * Standard's stored configuration — and the step fingerprint its stats
 * trend is bucketed by — is untouched by this ruleset existing.
 */
const switchingChainSpec = trackExerciseSpec<
  SwitchingChainConfigData,
  SequenceTrackExt,
  SwitchingChainState
>({
  exerciseRulesetVersionKey: EXERCISE_RULESET_VERSION_KEY,
  parse: (config) => SwitchingChainV1Config.parse(config),
  rules: switchingChainRules,
  initialExt,
  project: projectSwitchingChain,
  intent: (state) => targetScoringIntent(state.currentTargetNumber),
});

/** Switching Chain's state from a fact log alone, through the same fold the engine uses. */
export function foldSwitchingChainState(
  facts: EngineFacts,
  config: SwitchingChainConfigData,
  complete: boolean,
): SwitchingChainState {
  return switchingChainSpec.fold(facts, config, complete);
}

/** Switching Chain exercise engine (D264), built by the exercise shell. */
export class SwitchingChainEngine extends dartExerciseEngineClass(
  switchingChainSpec,
) {}

export const switchingChainEngineFactory = dartExerciseEngineFactory(
  switchingChainSpec,
  SwitchingChainEngine,
);

registerDartExerciseEngineFactory(switchingChainEngineFactory);
