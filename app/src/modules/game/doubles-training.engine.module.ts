import type { DoublesTrainingSnapshot, Seated, SeatFact } from "@lib/types";
import { newClientKey } from "./client-key.module";
import {
  BULL_TARGET_NUMBER,
  boardScore,
  doublesPath,
  isHitOn,
  targetAt,
} from "./board-progression.module";
import { registerEngineFactory } from "./engine.registry";
import { activeSeat } from "./seat-rota.module";
import { scoreCompareWinner } from "./match-outcome.module";
import type { GameEngine, GameEngineFactory } from "./interfaces";
import type {
  DartFact,
  DartObservation,
  DartZoneKey,
  DoublesTrainingSeatState,
  DoublesTrainingState,
  DoublesVisitOutcome,
  EngineFacts,
  StageFact,
  TurnFact,
} from "./types";

const STAGE: StageFact = {
  clientKey: "block-1",
  stageTypeKey: "EXERCISE_BLOCK",
  parentClientKey: null,
  sequence: 1,
};

function initialSeatState(seat: SeatFact): DoublesTrainingSeatState {
  return {
    participantRef: seat.participantRef,
    sideKey: seat.sideKey,
    targetIndex: 0,
    dartsThisVisit: 0,
    outcomes: [],
    status: "IN_PROGRESS",
  };
}

/** Doubles Training starting state: every configured seat aimed at DOUBLE 1, no darts thrown. */
export function initialDoublesTrainingState(
  config: Seated<DoublesTrainingSnapshot>,
): DoublesTrainingState {
  return {
    activeParticipantRef: config.seats[0].participantRef,
    status: "IN_PROGRESS",
    winningSideKey: null,
    seats: config.seats.map(initialSeatState),
  };
}

function toHitDartNumber(dartsThisVisit: number): 1 | 2 | 3 {
  if (dartsThisVisit === 1 || dartsThisVisit === 2 || dartsThisVisit === 3)
    return dartsThisVisit;
  throw new Error(
    `Invalid dartsThisVisit for a hit resolution: ${dartsThisVisit}`,
  );
}

function resolveVisit(
  state: DoublesTrainingSeatState,
  outcomes: DoublesVisitOutcome[],
): DoublesTrainingSeatState {
  if (state.targetIndex === 20) {
    return { ...state, dartsThisVisit: 0, outcomes, status: "COMPLETE" };
  }
  return {
    ...state,
    dartsThisVisit: 0,
    outcomes,
    targetIndex: state.targetIndex + 1,
  };
}

/**
 * Pure reducer: folds one dart observation onto one seat's
 * `DoublesTrainingSeatState`.
 * @throws when `state.status` is not `IN_PROGRESS`; undo first to correct it.
 */
export function applyDoublesTrainingDart(
  config: DoublesTrainingSnapshot,
  state: DoublesTrainingSeatState,
  observation: DartObservation,
): DoublesTrainingSeatState {
  if (state.status !== "IN_PROGRESS") {
    throw new Error(
      "Cannot record a dart once the session is complete; undo first to correct it.",
    );
  }

  const target = targetAt(doublesPath(config.targetOrder), state.targetIndex);
  const hit = isHitOn(target, observation);
  const dartsThisVisit = state.dartsThisVisit + 1;

  if (hit) {
    const outcome: DoublesVisitOutcome = {
      targetIndex: state.targetIndex,
      hit: true,
      hitDartNumber: toHitDartNumber(dartsThisVisit),
    };
    return resolveVisit(state, [...state.outcomes, outcome]);
  }
  if (dartsThisVisit < 3) {
    return { ...state, dartsThisVisit };
  }
  const outcome: DoublesVisitOutcome = {
    targetIndex: state.targetIndex,
    hit: false,
    hitDartNumber: null,
  };
  return resolveVisit(state, [...state.outcomes, outcome]);
}

function sumDartScores(darts: readonly DartFact[]): number {
  return darts.reduce((total, dart) => total + dart.score, 0);
}

function cloneTurns(turns: readonly TurnFact[]): TurnFact[] {
  return turns.map((turn) => ({ ...turn, darts: [...turn.darts] }));
}

function dartHitIntendedTarget(dart: DartFact): boolean {
  return (
    dart.hitTargetNumber === dart.intendedTargetNumber &&
    dart.hitZoneKey === dart.intendedZoneKey
  );
}

function isVisitOpen(turn: TurnFact): boolean {
  const lastDart = turn.darts.at(-1);
  if (!lastDart) return true;
  return turn.darts.length < 3 && !dartHitIntendedTarget(lastDart);
}

/**
 * Folds the whole fact log into the session's state, mirroring
 * `foldSinglesTrainingState`. Score-compare, most doubles hit wins — a new
 * derived metric: today's ruleset doc only tracked hit/miss ratios, not a
 * score (design spec). Every seat always takes exactly 21 visits regardless
 * of how many darts each used, so `activeSeat` needs no completion
 * predicate, same reasoning as Singles Training.
 */
function foldDoublesTrainingState(
  facts: EngineFacts,
  config: Seated<DoublesTrainingSnapshot>,
): DoublesTrainingState {
  const seats = config.seats.map((seat) => {
    let state = initialSeatState(seat);
    const seatTurns = facts.turns.filter(
      (turn) => turn.participantRef === seat.participantRef,
    );
    for (const turn of seatTurns) {
      for (const dart of turn.darts) {
        state = applyDoublesTrainingDart(config, state, {
          hitTargetNumber: dart.hitTargetNumber,
          hitZoneKey: dart.hitZoneKey,
          locationX: dart.locationX,
          locationY: dart.locationY,
        });
      }
    }
    return state;
  });

  const winningSideKey =
    seats.length === 1
      ? null
      : scoreCompareWinner(
          seats.map((seat) => ({
            sideKey: seat.sideKey,
            completed: seat.status === "COMPLETE",
            metric: seat.outcomes.filter((outcome) => outcome.hit).length,
          })),
          "HIGHEST",
        );

  const allComplete = seats.every((seat) => seat.status === "COMPLETE");
  const status: DoublesTrainingState["status"] =
    seats.length === 1
      ? seats[0].status
      : !allComplete
        ? "IN_PROGRESS"
        : winningSideKey !== null
          ? "COMPLETE"
          : "TIE";

  return {
    activeParticipantRef: activeSeat(facts, config.seats, "PER_SEAT")
      .participantRef,
    status,
    winningSideKey,
    seats,
  };
}

/**
 * Doubles Training: a 21-target path (the 20 doubles and BULL), each visit
 * ending the instant a dart hits its double or after 3 misses, per seat.
 * Score-compare, most doubles hit wins — every seat always takes exactly 21
 * visits, whatever each visit's own dart count.
 */
export class DoublesTrainingEngine implements GameEngine<
  DartObservation,
  DoublesTrainingState
> {
  readonly rulesetVersionKey = "DOUBLES_TRAINING_V1";
  readonly stageOwnership = "PER_SEAT" as const;
  private readonly turns: TurnFact[];

  constructor(
    private readonly config: Seated<DoublesTrainingSnapshot>,
    prior?: EngineFacts,
  ) {
    this.turns = prior ? cloneTurns(prior.turns) : [];
  }

  private deriveState(): DoublesTrainingState {
    return foldDoublesTrainingState(
      { stages: [{ ...STAGE }], turns: this.turns },
      this.config,
    );
  }

  private openOrCreateTurn(activeParticipantRef: string): TurnFact {
    const last = this.turns.at(-1);
    if (last && isVisitOpen(last)) return last;

    const turn: TurnFact = {
      clientKey: newClientKey(),
      stageClientKey: STAGE.clientKey,
      participantRef: activeParticipantRef,
      sequence: this.turns.length + 1,
      completedAt: null,
      totalScore: 0,
      darts: [],
    };
    this.turns.push(turn);
    return turn;
  }

  record(observation: DartObservation): DoublesTrainingState {
    const before = this.deriveState();
    const activeSeatState = before.seats.find(
      (seat) => seat.participantRef === before.activeParticipantRef,
    )!;
    if (activeSeatState.status !== "IN_PROGRESS") {
      throw new Error(
        "Cannot record a dart once the session is complete; undo first to correct it.",
      );
    }

    const target = targetAt(
      doublesPath(this.config.targetOrder),
      activeSeatState.targetIndex,
    );
    const openTurn = this.openOrCreateTurn(before.activeParticipantRef);
    const intendedZoneKey: DartZoneKey =
      target.kind === "BULL" ? "INNER_BULL" : "DOUBLE";
    const dart: DartFact = {
      sequence: openTurn.darts.length + 1,
      intendedTargetNumber:
        target.kind === "BULL" ? BULL_TARGET_NUMBER : target.number,
      intendedZoneKey,
      hitTargetNumber: observation.hitTargetNumber,
      hitZoneKey: observation.hitZoneKey,
      score: boardScore(observation.hitTargetNumber, observation.hitZoneKey),
      locationX: observation.locationX,
      locationY: observation.locationY,
    };

    openTurn.darts.push(dart);
    openTurn.totalScore = sumDartScores(openTurn.darts);
    if (!isVisitOpen(openTurn)) {
      openTurn.completedAt = new Date().toISOString();
    }

    return this.deriveState();
  }

  undo(): boolean {
    const openTurn = this.turns.at(-1);
    if (!openTurn || openTurn.darts.length === 0) return false;

    openTurn.darts.pop();
    if (openTurn.darts.length === 0) {
      this.turns.pop();
    } else {
      openTurn.completedAt = null;
      openTurn.totalScore = sumDartScores(openTurn.darts);
    }
    return true;
  }

  /**
   * Answers whether recording `observation` would end the WHOLE session —
   * this dart completes the active seat's 21st visit, and every other seat
   * has already reached COMPLETE.
   */
  wouldComplete(observation: DartObservation): boolean {
    const before = this.deriveState();
    const activeSeatState = before.seats.find(
      (seat) => seat.participantRef === before.activeParticipantRef,
    )!;
    if (activeSeatState.status !== "IN_PROGRESS") return false;

    const after = applyDoublesTrainingDart(
      this.config,
      activeSeatState,
      observation,
    );
    if (after.status !== "COMPLETE") return false;

    return before.seats
      .filter((seat) => seat.participantRef !== activeSeatState.participantRef)
      .every((seat) => seat.status === "COMPLETE");
  }

  isComplete(): boolean {
    return this.deriveState().status !== "IN_PROGRESS";
  }

  state(): DoublesTrainingState {
    return this.deriveState();
  }

  facts(): EngineFacts {
    return { stages: [{ ...STAGE }], turns: cloneTurns(this.turns) };
  }
}

export const doublesTrainingEngineFactory: GameEngineFactory<
  Seated<DoublesTrainingSnapshot>,
  DartObservation,
  DoublesTrainingState
> = {
  rulesetVersionKey: "DOUBLES_TRAINING_V1",
  stageOwnership: "PER_SEAT",
  create(config: Seated<DoublesTrainingSnapshot>, prior?: EngineFacts) {
    return new DoublesTrainingEngine(config, prior);
  },
};

registerEngineFactory(doublesTrainingEngineFactory);
