import type { CheckoutRules } from "./interfaces";
import type { CheckoutSeat, TurnFact, VisitVerdict } from "./types";

/** A Checkout seat before its first visit: on `target`, zero counters, `ext` as given. */
export function initialCheckoutSeat<TExt>(
  target: number,
  ext: TExt,
): CheckoutSeat<TExt> {
  return {
    target,
    visitStart: target,
    remaining: target,
    dartsInVisit: 0,
    visitIndex: 0,
    attemptIndex: 0,
    attempts: 0,
    checkouts: 0,
    status: "IN_PROGRESS",
    ext,
  };
}

/**
 * Books a closed attempt, runs `onAttemptClose` on the seat as it stood in
 * the closing visit, then opens `nextTarget` — or ends the seat as `DONE`
 * when it returns `null`.
 */
function closeAttempt<TExt>(
  seat: CheckoutSeat<TExt>,
  passed: boolean,
  verdict: VisitVerdict,
  rules: CheckoutRules<TExt>,
): CheckoutSeat<TExt> {
  const closed = rules.onAttemptClose(
    {
      ...seat,
      attempts: seat.attempts + 1,
      checkouts: seat.checkouts + (passed ? 1 : 0),
    },
    passed,
    verdict,
  );
  const next = rules.nextTarget(closed, passed);
  const target = next ?? closed.target;
  return {
    ...closed,
    target,
    visitStart: target,
    remaining: target,
    dartsInVisit: 0,
    visitIndex: 0,
    attemptIndex: closed.attemptIndex + 1,
    status: next === null ? "DONE" : closed.status,
  };
}

/**
 * A visit closed without a checkout: the next visit starts from the spent
 * remainder, or from this visit's start after a bust; the budget's last
 * visit fails the attempt.
 */
function carryVisit<TExt>(
  seat: CheckoutSeat<TExt>,
  verdict: Extract<VisitVerdict, { kind: "BUST" | "SPENT" }>,
  rules: CheckoutRules<TExt>,
): CheckoutSeat<TExt> {
  const visitIndex = seat.visitIndex + 1;
  if (visitIndex >= rules.visitsPerAttempt)
    return closeAttempt(seat, false, verdict, rules);
  const start = verdict.kind === "SPENT" ? verdict.remaining : seat.visitStart;
  return {
    ...seat,
    visitIndex,
    visitStart: start,
    remaining: start,
    dartsInVisit: 0,
  };
}

/**
 * The Checkout kernel's one reducer (Pattern 18 §Rule-kernel families):
 * `judge` the visit, then show it open, pass the attempt, or carry/fail it.
 * Every rule a ruleset makes lives in `rules`.
 */
export function applyCheckoutVisit<TExt>(
  seat: CheckoutSeat<TExt>,
  turn: TurnFact,
  rules: CheckoutRules<TExt>,
): CheckoutSeat<TExt> {
  const verdict = rules.judge(seat, turn);
  switch (verdict.kind) {
    case "OPEN":
      return {
        ...seat,
        remaining: verdict.remaining,
        dartsInVisit: verdict.darts,
      };
    case "CHECKOUT":
      return closeAttempt(seat, true, verdict, rules);
    case "BUST":
    case "SPENT":
      return carryVisit(seat, verdict, rules);
  }
}

/** Folds one seat over every turn in write order — the solo exercise's fold. */
export function foldCheckoutVisits<TExt>(
  turns: readonly TurnFact[],
  initial: CheckoutSeat<TExt>,
  rules: CheckoutRules<TExt>,
): CheckoutSeat<TExt> {
  return turns.reduce(
    (seat, turn) => applyCheckoutVisit(seat, turn, rules),
    initial,
  );
}
