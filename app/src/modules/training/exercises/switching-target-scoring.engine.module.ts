import type { SwitchingTargetScoringConfigData } from "@lib/types";
import { SwitchingTargetScoringV1Config } from "@lib/training/exercises/rulesets/types";
import type {
  DartFact,
  DartIntent,
  DartObservation,
  EngineFacts,
  TurnFact,
} from "@modules/types";
import { BULL_TARGET_NUMBER } from "@modules/game/board-progression.module";
import {
  appendObservedDart,
  cloneTurns,
  exerciseBlockStage,
  openOrCreateTurn,
  undoLastDart,
} from "@modules/game/turn-log.module";
import { registerDartExerciseEngineFactory } from "./dart-engine.registry";
import type {
  DartExerciseEngine,
  DartExerciseEngineFactory,
} from "./interfaces";
import { SOLO_PARTICIPANT_REF } from "./solo-participant.module";
import { targetScoringPoints } from "./target-scoring.engine.module";
import type { SwitchingTargetScoringState } from "./types";

const EXERCISE_RULESET_VERSION_KEY = "SWITCHING_TARGET_SCORING_V1" as const;
const STAGE = exerciseBlockStage();
const DARTS_PER_VISIT = 3;

/** The treble on a number, the bullseye on the bull — as Target Scoring. */
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
  bestFinished: number | null;
  completedSequences: number;
  hits: number;
  dartsThrown: number;
};

const INITIAL_PROGRESS: Progress = {
  targetIndex: 0,
  currentChain: 0,
  bestChain: 0,
  bestFinished: null,
  completedSequences: 0,
  hits: 0,
  dartsThrown: 0,
};

/**
 * Folds one dart onto the running progress. A hit grows the chain and moves
 * to the next target, wrapping after the last; a miss ends the chain and
 * restarts the sequence at the first target, mid-visit or not.
 */
function applyDart(
  config: SwitchingTargetScoringConfigData,
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
    const targetIndex = (progress.targetIndex + 1) % config.targets.length;
    return {
      ...progress,
      targetIndex,
      currentChain,
      bestChain: Math.max(progress.bestChain, currentChain),
      completedSequences:
        progress.completedSequences + (targetIndex === 0 ? 1 : 0),
      hits: progress.hits + 1,
      dartsThrown,
    };
  }
  return {
    ...progress,
    targetIndex: 0,
    currentChain: 0,
    bestFinished:
      progress.currentChain > 0
        ? Math.max(progress.bestFinished ?? 0, progress.currentChain)
        : progress.bestFinished,
    dartsThrown,
  };
}

/**
 * Folds the whole fact log into Switching Target Scoring state — a pure
 * function of `facts`/`config`/`complete`, mirroring
 * `foldTargetScoringState`. Darts are replayed in write order, which is what
 * reproduces each dart's target.
 */
export function foldSwitchingTargetScoringState(
  facts: EngineFacts,
  config: SwitchingTargetScoringConfigData,
  complete: boolean,
): SwitchingTargetScoringState {
  const progress = facts.turns
    .flatMap((turn) => turn.darts)
    .reduce((acc, dart) => applyDart(config, acc, dart), INITIAL_PROGRESS);

  return {
    currentTargetNumber: config.targets[progress.targetIndex],
    targetIndex: progress.targetIndex,
    currentChain: progress.currentChain,
    bestChain: progress.bestChain,
    markToBeat: progress.bestFinished,
    completedSequences: progress.completedSequences,
    hits: progress.hits,
    dartsThrown: progress.dartsThrown,
    status: complete ? "COMPLETE" : "IN_PROGRESS",
  };
}

/**
 * Switching Target Scoring: Target Scoring's points on a three-target
 * sequence — a hit advances, a miss resets the chain and restarts the
 * sequence (`docs/game-rules/training/exercises/switching-target-scoring.md`).
 * One `TurnFact` is one three-dart visit; the sequence carries across visit
 * boundaries. Clockless: completion arrives only through `expireTimer()`
 * (D264).
 */
export class SwitchingTargetScoringEngine implements DartExerciseEngine<SwitchingTargetScoringState> {
  readonly exerciseRulesetVersionKey = EXERCISE_RULESET_VERSION_KEY;

  private readonly config: SwitchingTargetScoringConfigData;
  private readonly turns: TurnFact[];
  private complete = false;

  constructor(config: SwitchingTargetScoringConfigData, prior?: EngineFacts) {
    this.config = SwitchingTargetScoringV1Config.parse(config);
    this.turns = prior ? cloneTurns(prior.turns) : [];
  }

  private deriveState(): SwitchingTargetScoringState {
    return foldSwitchingTargetScoringState(
      { stages: [{ ...STAGE }], turns: this.turns },
      this.config,
      this.complete,
    );
  }

  record(observation: DartObservation): SwitchingTargetScoringState {
    if (this.complete) {
      throw new Error(
        "Cannot record a dart once the exercise is complete; undo first to correct it.",
      );
    }
    const target = this.deriveState().currentTargetNumber;
    const turn = openOrCreateTurn(
      this.turns,
      STAGE.clientKey,
      SOLO_PARTICIPANT_REF,
      (last) => last.darts.length < DARTS_PER_VISIT,
    );
    appendObservedDart(turn, observation, intentFor(target));
    if (turn.darts.length === DARTS_PER_VISIT) {
      turn.completedAt = new Date().toISOString();
    }
    return this.deriveState();
  }

  undo(): boolean {
    if (this.complete) {
      this.complete = false;
      return true;
    }
    return undoLastDart(this.turns);
  }

  /** The step's countdown elapsed — the clock lives in the controller (D264). */
  expireTimer(): void {
    this.complete = true;
  }

  isComplete(): boolean {
    return this.complete;
  }

  state(): SwitchingTargetScoringState {
    return this.deriveState();
  }

  facts(): EngineFacts {
    return { stages: [{ ...STAGE }], turns: cloneTurns(this.turns) };
  }
}

export const switchingTargetScoringEngineFactory: DartExerciseEngineFactory<
  SwitchingTargetScoringConfigData,
  SwitchingTargetScoringState
> = {
  exerciseRulesetVersionKey: EXERCISE_RULESET_VERSION_KEY,
  create(config: SwitchingTargetScoringConfigData, prior?: EngineFacts) {
    return new SwitchingTargetScoringEngine(config, prior);
  },
};

registerDartExerciseEngineFactory(switchingTargetScoringEngineFactory);
