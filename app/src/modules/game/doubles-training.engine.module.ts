import type { DoublesTrainingSnapshot, Seated, SeatFact } from "@lib/types";
import { doublesPath, isHitOn, targetAt } from "./board-progression.module";
import { registerEngineFactory } from "./engine.registry";
import { activeSeat } from "./seat-rota.module";
import { activeSeatState, otherSeatsComplete } from "./seat-state.module";
import { doubleTargetIntent, endedRefusal } from "./turn-log.module";
import { scoreCompareOutcome } from "./match-outcome.module";
import {
  dartGameEngineClass,
  dartGameEngineFactory,
} from "./dart-engine-shell.module";
import { applyTrackDart, foldTrackSeats } from "./track-kernel.module";
import {
  advanceToEnd,
  closeOnHitOrAfter,
  noPoints,
  pathTarget,
} from "./track-policies";
import type { DartGameSpec, TrackRules } from "./interfaces";
import type {
  DartFact,
  DartObservation,
  DoublesTrainingSeatState,
  DoublesTrackExt,
  DoublesTrainingState,
  DoublesVisitOutcome,
  EngineFacts,
  TrackSeat,
  TurnFact,
} from "./types";

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

const COMPLETE_REFUSAL = endedRefusal("session is complete");

/** Visit-close policy: log the visit's outcome (the hitting dart's number, or a miss). */
function recordOutcome(
  seat: TrackSeat<DoublesTrackExt>,
): TrackSeat<DoublesTrackExt> {
  const hit = seat.hitsThisVisit > 0;
  const outcome: DoublesVisitOutcome = {
    targetIndex: seat.targetIndex,
    hit,
    hitDartNumber: hit ? toHitDartNumber(seat.dartsThisVisit) : null,
  };
  return { ...seat, ext: { outcomes: [...seat.ext.outcomes, outcome] } };
}

/** Doubles Training as Track policies: 21 doubles, a visit ends on a hit or after 3 darts. */
function doublesRules(
  config: DoublesTrainingSnapshot,
): TrackRules<DoublesTrackExt> {
  const advance = advanceToEnd<DoublesTrackExt>(20);
  return {
    doneMessage: COMPLETE_REFUSAL,
    target: pathTarget(doublesPath(config.targetOrder)),
    hit: isHitOn,
    points: noPoints,
    visitOpen: closeOnHitOrAfter(3),
    onVisitClose: (seat) => advance(recordOutcome(seat)),
  };
}

/**
 * Lifts a Doubles seat into the kernel's shape. `hitsThisVisit` is 0 by
 * construction: a Doubles visit closes on its first hit, so an open visit
 * never holds one.
 */
function toTrackSeat(
  state: DoublesTrainingSeatState,
): TrackSeat<DoublesTrackExt> {
  return {
    participantRef: state.participantRef,
    sideKey: state.sideKey,
    targetIndex: state.targetIndex,
    score: 0,
    dartsThisVisit: state.dartsThisVisit,
    hitsThisVisit: 0,
    status: state.status === "COMPLETE" ? "DONE" : "IN_PROGRESS",
    ext: { outcomes: state.outcomes },
  };
}

/** Projects a kernel seat back to Doubles Training's seat state. */
function toDoublesSeat(
  seat: TrackSeat<DoublesTrackExt>,
): DoublesTrainingSeatState {
  return {
    participantRef: seat.participantRef,
    sideKey: seat.sideKey,
    targetIndex: seat.targetIndex,
    dartsThisVisit: seat.dartsThisVisit,
    outcomes: seat.ext.outcomes,
    status: seat.status === "IN_PROGRESS" ? "IN_PROGRESS" : "COMPLETE",
  };
}

/**
 * Pure reducer: folds one dart observation onto one seat's
 * `DoublesTrainingSeatState`, via the Track kernel.
 * @throws when `state.status` is not `IN_PROGRESS`; undo first to correct it.
 */
export function applyDoublesTrainingDart(
  config: DoublesTrainingSnapshot,
  state: DoublesTrainingSeatState,
  observation: DartObservation,
): DoublesTrainingSeatState {
  return toDoublesSeat(
    applyTrackDart(toTrackSeat(state), observation, doublesRules(config)),
  );
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
export function foldDoublesTrainingState(
  facts: EngineFacts,
  config: Seated<DoublesTrainingSnapshot>,
): DoublesTrainingState {
  const seats = foldTrackSeats(
    facts.turns,
    config.seats,
    () => ({ outcomes: [] }),
    doublesRules(config),
  ).map(toDoublesSeat);

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
export class DoublesTrainingEngine extends dartGameEngineClass(
  doublesTrainingSpec,
) {}

export const doublesTrainingEngineFactory = dartGameEngineFactory(
  doublesTrainingSpec,
  DoublesTrainingEngine,
);

registerEngineFactory(doublesTrainingEngineFactory);
