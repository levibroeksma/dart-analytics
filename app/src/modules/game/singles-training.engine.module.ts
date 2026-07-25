import type { SinglesSnapshot } from "@lib/game/rulesets/types";
import {
  BULL_TARGET_NUMBER,
  boardScore,
  numbersPath,
  targetAt,
} from "./board-progression.module";
import { registerEngineFactory } from "./engine.registry";
import type { GameEngine, GameEngineFactory } from "./interfaces";
import type {
  BoardTarget,
  DartFact,
  DartObservation,
  EngineFacts,
  SinglesTrainingState,
  StageFact,
  TurnFact,
} from "./types";

const STAGE: StageFact = {
  clientKey: "block-1",
  stageTypeKey: "EXERCISE_BLOCK",
  parentClientKey: null,
  sequence: 1,
};

/**
 * Singles Training starting state: aimed at NUMBER 1, no darts thrown yet.
 */
export function initialSinglesTrainingState(): SinglesTrainingState {
  return {
    targetIndex: 0,
    totalPoints: 0,
    dartsThisVisit: 0,
    status: "IN_PROGRESS",
  };
}

function trainingPointsFor(
  target: BoardTarget,
  config: SinglesSnapshot,
  observation: DartObservation,
): number {
  if (target.kind === "BULL") {
    if (observation.hitTargetNumber !== BULL_TARGET_NUMBER) return 0;
    if (observation.hitZoneKey === "OUTER_BULL") return config.pointsSingle;
    if (observation.hitZoneKey === "INNER_BULL") return config.pointsDouble;
    return 0;
  }
  if (observation.hitTargetNumber !== target.number) return 0;
  if (observation.hitZoneKey === "SINGLE") return config.pointsSingle;
  if (observation.hitZoneKey === "DOUBLE") return config.pointsDouble;
  if (observation.hitZoneKey === "TREBLE") return config.pointsTreble;
  return 0;
}

/**
 * Pure reducer: folds one dart observation onto a `SinglesTrainingState`.
 * Training points are ring quality relative to the current target — a hit
 * on any other number scores zero regardless of ring, and BULL only ever
 * awards its single/double points, never treble. A visit resolves on its
 * 3rd dart: BULL completes the session, any other target advances to the
 * next one on the path.
 * @throws when `state.status` is not `IN_PROGRESS`; undo first to correct it.
 */
export function applySinglesTrainingDart(
  config: SinglesSnapshot,
  state: SinglesTrainingState,
  observation: DartObservation,
): SinglesTrainingState {
  if (state.status !== "IN_PROGRESS") {
    throw new Error(
      "Cannot record a dart once the session is complete; undo first to correct it.",
    );
  }

  const target = targetAt(numbersPath(), state.targetIndex);
  const totalPoints =
    state.totalPoints + trainingPointsFor(target, config, observation);
  const dartsThisVisit = state.dartsThisVisit + 1;

  if (dartsThisVisit < 3) {
    return { ...state, totalPoints, dartsThisVisit };
  }

  if (target.kind === "BULL") {
    return { ...state, totalPoints, dartsThisVisit: 0, status: "COMPLETE" };
  }
  return {
    ...state,
    totalPoints,
    dartsThisVisit: 0,
    targetIndex: state.targetIndex + 1,
  };
}

function sumDartScores(darts: readonly DartFact[]): number {
  return darts.reduce((total, dart) => total + dart.score, 0);
}

function cloneTurns(turns: readonly TurnFact[]): TurnFact[] {
  return turns.map((turn) => ({ ...turn, darts: [...turn.darts] }));
}

/**
 * Singles Training: a fixed path of 21 targets (1..20, then BULL), each
 * visit scored by ring quality relative to its own target rather than by
 * board value. The engine owns the fact log — `state()` derives the running
 * training-point total, current target and completion by folding `facts()`
 * through `applySinglesTrainingDart`; the total is never stored. Each dart's
 * `score` fact is the actual board score of the throw, independent of the
 * training points it earned.
 */
export class SinglesTrainingEngine implements GameEngine<
  DartObservation,
  SinglesTrainingState
> {
  readonly rulesetVersionKey = "SINGLES_V1";
  private readonly turns: TurnFact[];

  constructor(
    private readonly config: SinglesSnapshot,
    prior?: EngineFacts,
  ) {
    this.turns = prior ? cloneTurns(prior.turns) : [];
  }

  private deriveState(): SinglesTrainingState {
    let state = initialSinglesTrainingState();
    for (const turn of this.turns) {
      for (const dart of turn.darts) {
        state = applySinglesTrainingDart(this.config, state, {
          hitTargetNumber: dart.hitTargetNumber,
          hitZoneKey: dart.hitZoneKey,
        });
      }
    }
    return state;
  }

  private openOrCreateTurn(): TurnFact {
    const last = this.turns.at(-1);
    if (last && last.darts.length < 3) return last;

    const turn: TurnFact = {
      clientKey: crypto.randomUUID(),
      stageClientKey: STAGE.clientKey,
      sequence: this.turns.length + 1,
      completedAt: new Date().toISOString(),
      totalScore: 0,
      darts: [],
    };
    this.turns.push(turn);
    return turn;
  }

  /**
   * Appends one dart to the open visit, opening a new one when the last is
   * already 3 darts deep. `intendedTargetNumber` captures the segment this
   * dart was thrown at (the target's number, 25 for BULL); `intendedZoneKey`
   * is always `null` — unlike Bob's 27, Singles Training treats single,
   * double and treble on that segment as equally valid intentional outcomes
   * (differing only in point value), so no single ring is "the" intended
   * one, and recording one would fabricate an intent the player never held.
   * The fact's `score` is the dart's board score, never the training points
   * the derived total adds.
   * @throws when the session has already ended; the fact log is left untouched.
   */
  record(observation: DartObservation): SinglesTrainingState {
    const before = this.deriveState();
    const target = targetAt(numbersPath(), before.targetIndex);
    const after = applySinglesTrainingDart(this.config, before, observation);

    const openTurn = this.openOrCreateTurn();
    const dart: DartFact = {
      sequence: openTurn.darts.length + 1,
      intendedTargetNumber:
        target.kind === "BULL" ? BULL_TARGET_NUMBER : target.number,
      intendedZoneKey: null,
      hitTargetNumber: observation.hitTargetNumber,
      hitZoneKey: observation.hitZoneKey,
      score: boardScore(observation.hitTargetNumber, observation.hitZoneKey),
    };

    openTurn.darts.push(dart);
    openTurn.totalScore = sumDartScores(openTurn.darts);

    return after;
  }

  /**
   * Pops the last recorded dart, including one replayed from persisted
   * facts, and removes the visit entirely once it holds no darts — the
   * exact inverse of the `record()` call that created it.
   * @returns true if a dart was removed; false if there was nothing to undo.
   */
  undo(): boolean {
    const openTurn = this.turns.at(-1);
    if (!openTurn || openTurn.darts.length === 0) return false;

    openTurn.darts.pop();
    if (openTurn.darts.length === 0) {
      this.turns.pop();
    } else {
      openTurn.totalScore = sumDartScores(openTurn.darts);
    }
    return true;
  }

  /**
   * Answers whether recording `observation` would complete the session,
   * without mutating the fact log or the derived state. Only a visit's 3rd
   * dart, thrown at the BULL target, can ever complete the session.
   */
  wouldComplete(observation: DartObservation): boolean {
    const before = this.deriveState();
    if (before.status !== "IN_PROGRESS") return false;
    if (before.dartsThisVisit < 2) return false;

    const after = applySinglesTrainingDart(this.config, before, observation);
    return after.status !== "IN_PROGRESS";
  }

  isComplete(): boolean {
    return this.deriveState().status !== "IN_PROGRESS";
  }

  state(): SinglesTrainingState {
    return this.deriveState();
  }

  facts(): EngineFacts {
    return { stages: [STAGE], turns: cloneTurns(this.turns) };
  }
}

export const singlesTrainingEngineFactory: GameEngineFactory<
  SinglesSnapshot,
  DartObservation,
  SinglesTrainingState
> = {
  rulesetVersionKey: "SINGLES_V1",
  create(config: SinglesSnapshot, prior?: EngineFacts) {
    return new SinglesTrainingEngine(config, prior);
  },
};

registerEngineFactory(singlesTrainingEngineFactory);
