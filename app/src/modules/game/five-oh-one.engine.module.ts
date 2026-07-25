import type {
  FiveOhOneCheckout,
  FiveOhOneState,
  FiveOhOneVisitOutcome,
} from "./types";

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
