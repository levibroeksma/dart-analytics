import type { DoublesTrainingSnapshot, Seated, SeatFact } from "@lib/types";
import { doublesPath, isHitOn, targetAt } from "./board-progression.module";
import { registerEngineFactory } from "./engine.registry";
import { activeSeat } from "./seat-rota.module";
import {
  activeSeatState,
  foldSeatStates,
  otherSeatsComplete,
} from "./seat-state.module";
import {
  appendObservedDart,
  cloneTurns,
  doubleTargetIntent,
  openOrCreateTurn,
  undoLastDart,
} from "./turn-log.module";
import { scoreCompareOutcome } from "./match-outcome.module";
import type { GameEngine, GameEngineFactory } from "./interfaces";
import type {
  DartFact,
  DartObservation,
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
  const seats = foldSeatStates(
    facts.turns,
    config.seats,
    initialSeatState,
    (state, observation) =>
      applyDoublesTrainingDart(config, state, observation),
  );

  const outcome = scoreCompareOutcome(
    seats.map((seat) => ({
      sideKey: seat.sideKey,
      completed: seat.status === "COMPLETE",
      metric: seat.outcomes.filter((visit) => visit.hit).length,
    })),
    "HIGHEST",
    seats[0].status,
  );

  return {
    activeParticipantRef: activeSeat(facts, config.seats, "PER_SEAT")
      .participantRef,
    status: outcome.status,
    winningSideKey: outcome.winningSideKey,
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
    return openOrCreateTurn(
      this.turns,
      STAGE.clientKey,
      activeParticipantRef,
      isVisitOpen,
    );
  }

  record(observation: DartObservation): DoublesTrainingState {
    const before = this.deriveState();
    const seatBefore = activeSeatState(before);
    if (seatBefore.status !== "IN_PROGRESS") {
      throw new Error(
        "Cannot record a dart once the session is complete; undo first to correct it.",
      );
    }

    const target = targetAt(
      doublesPath(this.config.targetOrder),
      seatBefore.targetIndex,
    );
    const openTurn = this.openOrCreateTurn(before.activeParticipantRef);
    appendObservedDart(openTurn, observation, doubleTargetIntent(target));
    if (!isVisitOpen(openTurn)) {
      openTurn.completedAt = new Date().toISOString();
    }

    return this.deriveState();
  }

  undo(): boolean {
    return undoLastDart(this.turns);
  }

  /**
   * Answers whether recording `observation` would end the WHOLE session —
   * this dart completes the active seat's 21st visit, and every other seat
   * has already reached COMPLETE.
   */
  wouldComplete(observation: DartObservation): boolean {
    const before = this.deriveState();
    const seatBefore = activeSeatState(before);
    if (seatBefore.status !== "IN_PROGRESS") return false;

    const after = applyDoublesTrainingDart(
      this.config,
      seatBefore,
      observation,
    );
    if (after.status !== "COMPLETE") return false;

    return otherSeatsComplete(before.seats, seatBefore.participantRef);
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
