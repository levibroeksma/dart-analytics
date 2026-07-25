import type {
  FiveOhOneCheckout,
  FiveOhOneState,
  FiveOhOneVisitOutcome,
} from "./types";
import { FIVE_OH_ONE_START_SCORE } from "./types";

function isWinningCheckout(checkout: FiveOhOneCheckout | undefined): boolean {
  return checkout !== undefined && checkout.dartsOnDouble >= 1;
}

export function initialFiveOhOneState(startingScore: number): FiveOhOneState {
  return {
    remainingScore: startingScore,
    visitHistory: [],
    status: "IN_PROGRESS",
  };
}

export function applyVisit(
  state: FiveOhOneState,
  scoreAttempted: number,
  checkout?: FiveOhOneCheckout,
): FiveOhOneState {
  if (state.status !== "IN_PROGRESS") {
    throw new Error(
      "Cannot record a visit once the leg is won; undo first to correct it.",
    );
  }

  const wouldRemain = state.remainingScore - scoreAttempted;
  const reachedZero = wouldRemain === 0;
  const isBust =
    wouldRemain < 0 ||
    wouldRemain === 1 ||
    (reachedZero && !isWinningCheckout(checkout));

  const outcome: FiveOhOneVisitOutcome = isBust
    ? { scoreAttempted, isBust: true, remainingAfter: state.remainingScore }
    : { scoreAttempted, isBust: false, remainingAfter: wouldRemain };

  if (reachedZero && checkout !== undefined) {
    outcome.checkout = checkout;
  }

  return {
    remainingScore: outcome.remainingAfter,
    visitHistory: [...state.visitHistory, outcome],
    status: !isBust && reachedZero ? "WON" : "IN_PROGRESS",
  };
}

export class FiveOhOneEngine {
  private state: FiveOhOneState;
  private history: FiveOhOneState[] = [];

  constructor(startingScore: number = FIVE_OH_ONE_START_SCORE) {
    this.state = initialFiveOhOneState(startingScore);
  }

  recordVisit(
    scoreAttempted: number,
    checkout?: FiveOhOneCheckout,
  ): FiveOhOneState {
    const next = applyVisit(this.state, scoreAttempted, checkout);
    this.history.push(this.state);
    this.state = next;
    return this.state;
  }

  /** Reverts exactly the last recorded visit, one at a time, even across the leg-won boundary. */
  undoLastVisit(): boolean {
    if (this.history.length === 0) return false;
    this.state = this.history.pop()!;
    return true;
  }

  currentScore(): number {
    return this.state.remainingScore;
  }

  /** Returns the engine's live internal visit history; callers must not mutate the returned array. */
  visitHistory(): FiveOhOneVisitOutcome[] {
    return this.state.visitHistory;
  }

  isComplete(): boolean {
    return this.state.status === "WON";
  }
}
