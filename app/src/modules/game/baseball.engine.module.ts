import type { BaseballSnapshot, Seated } from "@lib/types";
import { numbersPath } from "./board-progression.module";
import {
  dartGameEngineClass,
  dartGameEngineFactory,
} from "./dart-engine-shell.module";
import { registerEngineFactory } from "./engine.registry";
import { activeSeat } from "./seat-rota.module";
import { activeSeatState } from "./seat-state.module";
import { applyTrackDart, foldTrackSeats } from "./track-kernel.module";
import {
  advanceToEnd,
  anyRingEitherBull,
  closeAfter,
  pathTarget,
  pointsTable,
  tallyRoundPoints,
} from "./track-policies";
import type { DartGameSpec, TrackRules } from "./interfaces";
import type {
  BaseballSeatState,
  BaseballState,
  BaseballTrackExt,
  DartIntent,
  DartObservation,
  EngineFacts,
  SeatState,
  TrackSeat,
} from "./types";

/** Nine innings; inning n aims at number n. */
export const BASEBALL_INNINGS = 9;

const LAST_INNING_INDEX = BASEBALL_INNINGS - 1;

const PATH = numbersPath().slice(0, BASEBALL_INNINGS);

const GAME_ENDED =
  "Cannot record a dart once the game has ended; undo first to correct it.";

const NO_INTENT: DartIntent = {
  intendedTargetNumber: null,
  intendedZoneKey: null,
};

/**
 * Baseball Darts as Track policies: innings 1–9, runs by ring on the
 * inning's number (1/2/3), nothing elsewhere; three-dart visits, the seat
 * finishing on inning 9's close.
 */
const BASEBALL_RULES: TrackRules<BaseballTrackExt> = {
  doneMessage: GAME_ENDED,
  target: pathTarget<BaseballTrackExt>(PATH),
  hit: anyRingEitherBull,
  points: pointsTable({
    number: {
      SINGLE: 1,
      INNER_SINGLE: 1,
      OUTER_SINGLE: 1,
      DOUBLE: 2,
      TREBLE: 3,
    },
    bull: {},
  }),
  onDart: tallyRoundPoints<BaseballTrackExt>(1),
  visitOpen: closeAfter<BaseballTrackExt>(3),
  onVisitClose: advanceToEnd<BaseballTrackExt>(LAST_INNING_INDEX),
};

function emptyInnings(): BaseballTrackExt {
  return { roundTotals: Array.from({ length: BASEBALL_INNINGS }, () => 0) };
}

function initialSeatState(seat: SeatState): BaseballSeatState {
  return {
    participantRef: seat.participantRef,
    sideKey: seat.sideKey,
    targetIndex: 0,
    runs: 0,
    runsPerInning: emptyInnings().roundTotals,
    dartsThisVisit: 0,
    hitsThisVisit: 0,
    status: "IN_PROGRESS",
  };
}

/** Baseball starting state: every seat at inning 1 with no runs. */
export function initialBaseballState(
  config: Seated<BaseballSnapshot>,
): BaseballState {
  return {
    activeParticipantRef: config.seats[0].participantRef,
    status: "IN_PROGRESS",
    winningSideKey: null,
    seats: config.seats.map(initialSeatState),
  };
}

/** Lifts a Baseball seat into the kernel's shape: runs as the score, runs per inning as the extra. */
function toTrackSeat(state: BaseballSeatState): TrackSeat<BaseballTrackExt> {
  return {
    participantRef: state.participantRef,
    sideKey: state.sideKey,
    targetIndex: state.targetIndex,
    score: state.runs,
    dartsThisVisit: state.dartsThisVisit,
    hitsThisVisit: state.hitsThisVisit,
    status: state.status === "IN_PROGRESS" ? "IN_PROGRESS" : "DONE",
    ext: { roundTotals: state.runsPerInning },
  };
}

/** Projects a kernel seat back to Baseball's seat state. */
function toBaseballSeat(seat: TrackSeat<BaseballTrackExt>): BaseballSeatState {
  return {
    participantRef: seat.participantRef,
    sideKey: seat.sideKey,
    targetIndex: seat.targetIndex,
    runs: seat.score,
    runsPerInning: seat.ext.roundTotals,
    dartsThisVisit: seat.dartsThisVisit,
    hitsThisVisit: seat.hitsThisVisit,
    status: seat.status === "IN_PROGRESS" ? "IN_PROGRESS" : "COMPLETE",
  };
}

/**
 * Pure reducer, via the Track kernel: folds one dart onto one seat.
 * @throws when the seat has finished inning 9; undo first to correct it.
 */
export function applyBaseballDart(
  state: BaseballSeatState,
  observation: DartObservation,
): BaseballSeatState {
  return toBaseballSeat(
    applyTrackDart(toTrackSeat(state), observation, BASEBALL_RULES),
  );
}

/** Folds the fact log into the session's state; complete once every seat has closed inning 9. */
export function foldBaseballState(
  facts: EngineFacts,
  config: Seated<BaseballSnapshot>,
): BaseballState {
  const seats = foldTrackSeats(
    facts.turns,
    config.seats,
    emptyInnings,
    BASEBALL_RULES,
  ).map(toBaseballSeat);
  return {
    activeParticipantRef: activeSeat(facts, config.seats, "PER_SEAT")
      .participantRef,
    status: seats.every((seat) => seat.status === "COMPLETE")
      ? "COMPLETE"
      : "IN_PROGRESS",
    winningSideKey: null,
    seats,
  };
}

/** A seat's runs in `state`; 0 for a participant not seated. */
function runsOf(state: BaseballState, participantRef: string): number {
  return (
    state.seats.find((seat) => seat.participantRef === participantRef)?.runs ??
    0
  );
}

/** Whether the next dart is inning 9's third, which ends the game. */
function closesLastInning(state: BaseballState): boolean {
  if (state.status !== "IN_PROGRESS") return false;
  const seat = activeSeatState(state);
  return seat.targetIndex === LAST_INNING_INDEX && seat.dartsThisVisit === 2;
}

/**
 * Baseball Darts for the dart engine shell: three darts an inning, no
 * stored intent, and a closed visit persists the runs it scored.
 */
const baseballSpec: DartGameSpec<Seated<BaseballSnapshot>, BaseballState> = {
  rulesetVersionKey: "BASEBALL_V1",
  stageOwnership: "PER_SEAT",
  fold: foldBaseballState,
  refusal: (state) => (state.status === "IN_PROGRESS" ? null : GAME_ENDED),
  intent: () => NO_INTENT,
  isVisitOpen: (turn) => turn.darts.length < 3,
  wouldComplete: closesLastInning,
  closedVisitTotal: (opened, closed, participantRef) =>
    runsOf(closed, participantRef) - runsOf(opened, participantRef),
};

/** Baseball Darts engine (Pattern 18), built by the dart engine shell. */
export class BaseballEngine extends dartGameEngineClass(baseballSpec) {}

export const baseballEngineFactory = dartGameEngineFactory(
  baseballSpec,
  BaseballEngine,
);

registerEngineFactory(baseballEngineFactory);
