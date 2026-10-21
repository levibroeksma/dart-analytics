import type {
  DartObservation,
  DartZoneKey,
  MarksHit,
  MarksSeatState,
  MultiSeatState,
  TurnFact,
} from "./types";
import { activeSeatState } from "./seat-state.module";
import {
  appendObservedDart,
  openOrCreateTurn,
  refuseWhenEnded,
} from "./turn-log.module";

export type { MarksHit } from "./types";

export const MARKS_TO_CLOSE = 3;
const DARTS_PER_VISIT = 3;

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
  refuseWhenEnded(state.status !== "IN_PROGRESS", "game has ended");
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

/**
 * A marks-close engine's `record()`: appends one dart to the open visit,
 * opening a new one when the last is closed. `completedAt` is stamped by a
 * visit's 3rd dart or by the dart that completes the run. Validated against
 * `derive()` first, so a throw leaves `turns` untouched.
 * @param turns The engine's fact log, mutated in place
 * @param stageClientKey The stage new visits open under
 * @param derive Folds `turns` into the engine's state
 * @throws when the active seat has already completed.
 */
export function recordMarksDart<TState extends MultiSeatState<MarksSeatState>>(
  turns: TurnFact[],
  stageClientKey: string,
  observation: DartObservation,
  derive: () => TState,
): TState {
  const before = derive();
  refuseWhenEnded(
    activeSeatState(before).status !== "IN_PROGRESS",
    "game has ended",
  );
  const openTurn = openOrCreateTurn(
    turns,
    stageClientKey,
    before.activeParticipantRef,
    (last) => last.completedAt === null && last.darts.length < DARTS_PER_VISIT,
  );
  appendObservedDart(openTurn, observation);
  const after = derive();
  if (
    openTurn.darts.length === DARTS_PER_VISIT ||
    activeSeatState(after).status === "COMPLETE"
  ) {
    openTurn.completedAt = new Date().toISOString();
  }
  return derive();
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
