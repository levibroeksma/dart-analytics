import type {
  DoublesTarget,
  DoublesTrainingState,
  VisitOutcome,
} from "./types";

function targetForIndex(targetIndex: number): DoublesTarget {
  return targetIndex < 20
    ? { kind: "DOUBLE", number: targetIndex + 1 }
    : { kind: "BULL" };
}

function resolveVisit(
  state: DoublesTrainingState,
  visitHistory: VisitOutcome[],
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
    const outcome: VisitOutcome = {
      targetIndex: state.targetIndex,
      hit: true,
      hitDartNumber: dartsThisVisit as 1 | 2 | 3,
    };
    return resolveVisit(state, [...state.visitHistory, outcome]);
  }

  if (dartsThisVisit < 3) {
    return { ...state, dartsThisVisit };
  }

  const outcome: VisitOutcome = {
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

  visitHistory(): VisitOutcome[] {
    return this.state.visitHistory;
  }

  isComplete(): boolean {
    return this.state.status === "COMPLETE";
  }
}
