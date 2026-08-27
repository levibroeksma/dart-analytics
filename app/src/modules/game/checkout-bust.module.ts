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
