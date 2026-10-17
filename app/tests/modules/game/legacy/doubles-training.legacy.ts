/**
 * Frozen copy of the pre-kernel Doubles Training engine, for the kernel
 * oracle only (Track PR 1, D467). Deleted in the same PR once goldens hold.
 */
import type { DoublesTrainingSnapshot, Seated, SeatFact } from "@lib/types";
import {
  doublesPath,
  isHitOn,
  targetAt,
} from "@modules/game/board-progression.module";
import { activeSeat } from "@modules/game/seat-rota.module";
import {
  activeSeatState,
  foldSeatStates,
  otherSeatsComplete,
} from "@modules/game/seat-state.module";
import { doubleTargetIntent } from "@modules/game/turn-log.module";
import { scoreCompareOutcome } from "@modules/game/match-outcome.module";
import { dartGameEngineClass } from "@modules/game/dart-engine-shell.module";
import type { DartGameSpec } from "@modules/interfaces";
import type {
  DartFact,
  DartObservation,
  DoublesTrainingSeatState,
  DoublesTrainingState,
  DoublesVisitOutcome,
  EngineFacts,
  TurnFact,
} from "@modules/types";

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
function applyDoublesTrainingDart(
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

const COMPLETE_REFUSAL =
  "Cannot record a dart once the session is complete; undo first to correct it.";

/**
 * Doubles Training's rules for the dart engine shell: a 21-target path (the
 * 20 doubles and BULL), each visit ending the instant a dart hits its double
 * or after 3 misses, per seat. Score-compare, most doubles hit wins.
 */
const doublesTrainingSpec: DartGameSpec<
  Seated<DoublesTrainingSnapshot>,
  DoublesTrainingState
> = {
  rulesetVersionKey: "DOUBLES_TRAINING_V1",
  stageOwnership: "PER_SEAT",
  fold: foldDoublesTrainingState,
  refusal: (state) =>
    activeSeatState(state).status === "IN_PROGRESS" ? null : COMPLETE_REFUSAL,
  intent: (state, config) =>
    doubleTargetIntent(
      targetAt(
        doublesPath(config.targetOrder),
        activeSeatState(state).targetIndex,
      ),
    ),
  isVisitOpen,
  wouldComplete: (state, observation, config) => {
    const seat = activeSeatState(state);
    if (seat.status !== "IN_PROGRESS") return false;
    if (
      applyDoublesTrainingDart(config, seat, observation).status !== "COMPLETE"
    )
      return false;
    return otherSeatsComplete(
      state.seats,
      seat.participantRef,
      (other) => other.status === "COMPLETE",
    );
  },
};

/** Doubles Training engine (Pattern 18), built by the dart engine shell. */
export class LegacyDoublesTrainingEngine extends dartGameEngineClass(
  doublesTrainingSpec,
) {}
