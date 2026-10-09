import type { DartZoneKey, MarksHit, MarksSeatState } from "./types";

export type { MarksHit } from "./types";

export const MARKS_TO_CLOSE = 3;
export const DARTS_PER_VISIT = 3;

/** Marks a number ring adds to its own objective. */
export const NUMBER_RING_MARKS: Partial<Record<DartZoneKey, number>> = {
  SINGLE: 1,
  INNER_SINGLE: 1,
  OUTER_SINGLE: 1,
  DOUBLE: 2,
  TREBLE: 3,
};

/** Marks a bull ring adds to the bull. */
export const BULL_RING_MARKS: Partial<Record<DartZoneKey, number>> = {
  OUTER_BULL: 1,
  INNER_BULL: 2,
};

/** A seat with no marks on `objectiveCount` objectives. */
export function initialMarksSeat(
  seat: { participantRef: string; sideKey: string },
  objectiveCount: number,
): MarksSeatState {
  return {
    participantRef: seat.participantRef,
    sideKey: seat.sideKey,
    marks: Array.from({ length: objectiveCount }, () => 0),
    closedAtDart: Array.from({ length: objectiveCount }, () => null),
    objectiveHits: Array.from({ length: objectiveCount }, () => 0),
    trebleHits: 0,
    dartsThrown: 0,
    dartsThisVisit: 0,
    status: "IN_PROGRESS",
  };
}

/**
 * Pure reducer: folds one already-mapped dart onto one seat. Marks add to
 * their objective, capped at 3; overflow is discarded. Every dart counts as
 * thrown. The dart that closes the last open objective completes the seat
 * immediately, on any dart of the visit. Hits are tallied per objective and
 * as trebles (3-mark hits), uncapped.
 * @throws when the seat is already complete; undo first to correct it.
 */
export function applyMarksDart(
  state: MarksSeatState,
  hit: MarksHit,
): MarksSeatState {
  if (state.status !== "IN_PROGRESS") {
    throw new Error(
      "Cannot record a dart once the game has ended; undo first to correct it.",
    );
  }
  const dartsThrown = state.dartsThrown + 1;
  const marks = [...state.marks];
  const closedAtDart = [...state.closedAtDart];
  const objectiveHits = [...state.objectiveHits];
  if (hit) objectiveHits[hit.objectiveIndex] += 1;
  if (hit && marks[hit.objectiveIndex] < MARKS_TO_CLOSE) {
    marks[hit.objectiveIndex] = Math.min(
      MARKS_TO_CLOSE,
      marks[hit.objectiveIndex] + hit.marks,
    );
    if (marks[hit.objectiveIndex] === MARKS_TO_CLOSE) {
      closedAtDart[hit.objectiveIndex] = dartsThrown;
    }
  }
  const complete = marks.every((count) => count === MARKS_TO_CLOSE);
  const visitDarts = state.dartsThisVisit + 1;
  return {
    ...state,
    marks,
    closedAtDart,
    objectiveHits,
    trebleHits: state.trebleHits + (hit?.marks === 3 ? 1 : 0),
    dartsThrown,
    dartsThisVisit: complete || visitDarts === DARTS_PER_VISIT ? 0 : visitDarts,
    status: complete ? "COMPLETE" : "IN_PROGRESS",
  };
}

/** Marks that counted toward closing, after the cap. */
export function effectiveMarks(seat: MarksSeatState): number {
  return seat.marks.reduce((sum, count) => sum + count, 0);
}

/** Marks per round of 3 darts; 0 before the first dart. */
export function marksPerRound(seat: MarksSeatState): number {
  return seat.dartsThrown === 0
    ? 0
    : (effectiveMarks(seat) / seat.dartsThrown) * DARTS_PER_VISIT;
}
