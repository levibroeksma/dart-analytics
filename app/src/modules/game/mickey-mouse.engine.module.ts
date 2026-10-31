import type { MickeyMouseSnapshot, Seated } from "@lib/types";
import { BULL_TARGET_NUMBER } from "./board-progression.module";
import { registerEngineFactory } from "./engine.registry";
import {
  dartGameEngineClass,
  dartGameEngineFactory,
} from "./dart-engine-shell.module";
import { foldMarks, marksGameSpec } from "./marks-kernel.module";
import {
  BULL_RING_MARKS,
  initialMarksSeat,
  NUMBER_RING_MARKS,
} from "./marks-close.module";
import type {
  DartObservation,
  DartZoneKey,
  EngineFacts,
  MarksHit,
  MarksRules,
  MickeyMouseObjective,
  MickeyMouseSeatState,
  MickeyMouseState,
} from "./types";

/** The twelve Mickey Mouse objectives in display order; the bull is `BULL_TARGET_NUMBER`. */
export const MICKEY_MOUSE_OBJECTIVES: readonly MickeyMouseObjective[] = [
  20,
  19,
  18,
  17,
  16,
  15,
  14,
  13,
  12,
  "DOUBLES",
  "TRIPLES",
  BULL_TARGET_NUMBER,
];

const BULL_INDEX = MICKEY_MOUSE_OBJECTIVES.indexOf(BULL_TARGET_NUMBER);

const CATEGORY_INDEX: Partial<Record<DartZoneKey, number>> = {
  DOUBLE: MICKEY_MOUSE_OBJECTIVES.indexOf("DOUBLES"),
  TREBLE: MICKEY_MOUSE_OBJECTIVES.indexOf("TRIPLES"),
};

function numberOf(observation: DartObservation): number | null {
  const number = observation.hitTargetNumber;
  return number !== null && number >= 1 && number <= 20 ? number : null;
}

/**
 * The objective a dart marks first: a bull ring marks the bull whatever
 * number it carries; a ring on 12–20 marks that number; a double or treble on
 * 1–11 marks Doubles / Triples by one. A single on 1–11 and a miss mark
 * nothing.
 */
export function mickeyMouseMarksOf(observation: DartObservation): MarksHit {
  const bullMarks = BULL_RING_MARKS[observation.hitZoneKey];
  if (bullMarks !== undefined) {
    return { objectiveIndex: BULL_INDEX, marks: bullMarks };
  }
  const number = numberOf(observation);
  const marks = NUMBER_RING_MARKS[observation.hitZoneKey];
  if (number === null || !marks) return null;
  const numberIndex = MICKEY_MOUSE_OBJECTIVES.indexOf(number);
  if (numberIndex !== -1) return { objectiveIndex: numberIndex, marks };
  const categoryIndex = CATEGORY_INDEX[observation.hitZoneKey];
  return categoryIndex === undefined
    ? null
    : { objectiveIndex: categoryIndex, marks: 1 };
}

/**
 * The double-dip: a double or treble on 12–20 also marks Doubles / Triples by
 * one, whether or not its number is still open.
 */
export function mickeyMouseDipOf(observation: DartObservation): MarksHit {
  const number = numberOf(observation);
  const categoryIndex = CATEGORY_INDEX[observation.hitZoneKey];
  if (
    number === null ||
    categoryIndex === undefined ||
    !MICKEY_MOUSE_OBJECTIVES.includes(number)
  ) {
    return null;
  }
  return { objectiveIndex: categoryIndex, marks: 1 };
}

/** Whether a dart can mark any objective — the visit preview's hit/miss. */
export function isMickeyMouseTarget(observation: DartObservation): boolean {
  return mickeyMouseMarksOf(observation) !== null;
}

function initialSeatState(seat: {
  participantRef: string;
  sideKey: string;
}): MickeyMouseSeatState {
  return {
    ...initialMarksSeat(seat, MICKEY_MOUSE_OBJECTIVES.length),
    points: 0,
  };
}

/** Mickey Mouse as marks rules: no points anywhere, the dip as a second mark. */
const MICKEY_MOUSE_RULES: MarksRules<MickeyMouseSeatState> = {
  initialSeat: initialSeatState,
  hitOf: (_seat, _opponent, observation) => mickeyMouseMarksOf(observation),
  dipOf: (_seat, observation) => mickeyMouseDipOf(observation),
  valueOf: () => null,
};

/** Mickey Mouse's starting state: every seat with no marks, seat 0 active. */
export function initialMickeyMouseState(
  config: Seated<MickeyMouseSnapshot>,
): MickeyMouseState {
  return {
    activeParticipantRef: config.seats[0].participantRef,
    status: "IN_PROGRESS",
    winnerParticipantRef: null,
    seats: config.seats.map(initialSeatState),
  };
}

/**
 * Folds the whole fact log into the session's state — what the engine's own
 * `state()` and the play controller's `state()` both call. Complete once the
 * seat is closed out.
 */
export function foldMickeyMouseState(
  facts: EngineFacts,
  config: Seated<MickeyMouseSnapshot>,
): MickeyMouseState {
  return foldMarks(facts, config.seats, MICKEY_MOUSE_RULES);
}

const mickeyMouseSpec = marksGameSpec<
  Seated<MickeyMouseSnapshot>,
  MickeyMouseSeatState
>({
  rulesetVersionKey: "MICKEY_MOUSE_V1",
  rulesetVersionKeys: [],
  rules: MICKEY_MOUSE_RULES,
});

/**
 * Mickey Mouse: close 20–12, Doubles, Triples and the bull in as few darts as
 * possible, alone. The engine owns the fact log; marks and closures are
 * folded from it on every read and never stored. Darts carry no intent.
 */
export class MickeyMouseEngine extends dartGameEngineClass(mickeyMouseSpec) {}

export const mickeyMouseEngineFactory = dartGameEngineFactory(
  mickeyMouseSpec,
  MickeyMouseEngine,
);

registerEngineFactory(mickeyMouseEngineFactory);
