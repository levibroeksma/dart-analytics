import type { TurnFact } from "./types";

/**
 * The double-out bust/checkout rule shared by every X01-style ladder game
 * (501, 121, TUOD): an overshoot busts; leaving exactly 1 busts, because 1
 * cannot be finished on a double (D1 = 2); reaching exactly 0 busts unless
 * the visit ended on a double. A ruleset with its own extra bust condition
 * — 121's unreachable-remainder-on-the-final-visit rule, TUOD's
 * odd-remainder-with-one-dart-left rule — ORs it onto `busted` itself; this
 * function only ever states the rule every one of them shares.
 */
export function resolveCheckoutAttempt(
  remainingBefore: number,
  scored: number,
  endedOnDouble: boolean,
): { remainingAfter: number; checkedOut: boolean; busted: boolean } {
  const remainingAfter = remainingBefore - scored;
  const checkedOut = remainingAfter === 0 && endedOnDouble;
  const busted =
    remainingAfter < 0 ||
    remainingAfter === 1 ||
    (remainingAfter === 0 && !checkedOut);
  return { remainingAfter, checkedOut, busted };
}

/**
 * How many of these turns were failed checkout attempts — completed
 * visits whose `totalScore` was zeroed by a bust, but whose own darts
 * summed to more than zero. `resolveCheckoutAttempt`'s own rule means a
 * bust can only ever be triggered by a visit that threw something
 * (`remainingAfter < 0`, `=== 1`, or `=== 0` all require `scored > 0`), so
 * this can never mistake a genuine zero-score visit (three misses, which
 * never moves `remainingAfter` at all) for a failed checkout. Only
 * meaningful for VISUAL_BOARD sessions — a QUICK_SCORE turn's `darts` is
 * always `[]`, so every QUICK_SCORE bust reads as 0 here; callers must
 * gate display on the session's own `inputModeKey`.
 */
export function checkoutAttemptCount(turns: readonly TurnFact[]): number {
  return turns.filter(
    (turn) =>
      turn.completedAt !== null &&
      turn.totalScore === 0 &&
      turn.darts.reduce((sum, dart) => sum + dart.score, 0) > 0,
  ).length;
}
