import type {
  DoublesTarget,
  DoublesTrainingState,
  DoublesVisitOutcome,
} from "./types";

function targetForIndex(targetIndex: number): DoublesTarget {
  return targetIndex < 20
    ? { kind: "DOUBLE", number: targetIndex + 1 }
    : { kind: "BULL" };
}

function resolveVisit(
  state: DoublesTrainingState,
  visitHistory: DoublesVisitOutcome[],
): DoublesTrainingState {
  if (state.targetIndex === 20) {
    return { ...state, dartsThisVisit: 0, visitHistory, status: "COMPLETE" };
  }
  return {
    ...state,
    dartsThisVisit: 0,
    visitHistory,
    targetIndex: state.targetIndex + 1,
  };
}

function toHitDartNumber(dartsThisVisit: number): 1 | 2 | 3 {
  if (dartsThisVisit === 1 || dartsThisVisit === 2 || dartsThisVisit === 3) {
    return dartsThisVisit;
  }
  throw new Error(
    `Invalid dartsThisVisit for a hit resolution: ${dartsThisVisit}`,
  );
}

export function initialDoublesTrainingState(): DoublesTrainingState {
  return {
    targetIndex: 0,
    dartsThisVisit: 0,
    visitHistory: [],
    status: "IN_PROGRESS",
  };
}

export function applyDart(
  state: DoublesTrainingState,
  hit: boolean,
): DoublesTrainingState {
  if (state.status !== "IN_PROGRESS") {
    throw new Error(
      "Cannot record a dart once the session is complete; undo first to correct it.",
    );
  }

  const dartsThisVisit = state.dartsThisVisit + 1;

  if (hit) {
    const outcome: DoublesVisitOutcome = {
      targetIndex: state.targetIndex,
      hit: true,
      hitDartNumber: toHitDartNumber(dartsThisVisit),
    };
    return resolveVisit(state, [...state.visitHistory, outcome]);
  }

  if (dartsThisVisit < 3) {
    return { ...state, dartsThisVisit };
  }

  const outcome: DoublesVisitOutcome = {
    targetIndex: state.targetIndex,
    hit: false,
    hitDartNumber: null,
  };
  return resolveVisit(state, [...state.visitHistory, outcome]);
}

export class DoublesTrainingEngine {
  private state: DoublesTrainingState;
  private history: DoublesTrainingState[] = [];

  constructor() {
    this.state = initialDoublesTrainingState();
  }

  recordDart(hit: boolean): DoublesTrainingState {
    const next = applyDart(this.state, hit);
    this.history.push(this.state);
    this.state = next;
    return this.state;
  }

  /** Reverts exactly the last recorded dart, one at a time, even across visit/completion boundaries. */
  undoLastDart(): boolean {
    if (this.history.length === 0) return false;
    this.state = this.history.pop()!;
    return true;
  }

  currentTarget(): DoublesTarget {
    return targetForIndex(this.state.targetIndex);
  }

  /** Returns the engine's live internal visit history; callers must not mutate the returned array. */
  visitHistory(): DoublesVisitOutcome[] {
    return this.state.visitHistory;
  }

  isComplete(): boolean {
    return this.state.status === "COMPLETE";
  }
}
