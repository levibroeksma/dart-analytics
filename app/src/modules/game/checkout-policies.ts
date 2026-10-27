import { resolveCheckoutAttempt } from "./checkout-bust.module";
import type { CheckoutSeat, DartFact, TurnFact, VisitVerdict } from "./types";

const DARTS_PER_VISIT = 3;

/** A double-out finishing dart: any double, or the bullseye. */
function isFinishingDart(dart: Pick<DartFact, "hitZoneKey">): boolean {
  return dart.hitZoneKey === "DOUBLE" || dart.hitZoneKey === "INNER_BULL";
}

/**
 * Judges a visit from its darts alone, walking from the seat's
 * `visitStart` under the double-out rule (`resolveCheckoutAttempt`): a
 * checkout, a bust, a third dart short of zero (`SPENT`), or still open.
 */
export function dartWalkJudge<TExt>(
  seat: CheckoutSeat<TExt>,
  turn: TurnFact,
): VisitVerdict {
  let remaining = seat.visitStart;
  for (const [index, dart] of turn.darts.entries()) {
    const outcome = resolveCheckoutAttempt(
      remaining,
      dart.score,
      isFinishingDart(dart),
    );
    if (outcome.checkedOut) return { kind: "CHECKOUT", darts: index + 1 };
    if (outcome.busted) return { kind: "BUST" };
    remaining = outcome.remainingAfter;
  }
  return turn.darts.length === DARTS_PER_VISIT
    ? { kind: "SPENT", remaining }
    : { kind: "OPEN", remaining, darts: turn.darts.length };
}

/** Next target: one above the current, until `last` has been attempted. */
export function consecutiveTargets(last: number) {
  return <TExt>(seat: CheckoutSeat<TExt>): number | null =>
    seat.target < last ? seat.target + 1 : null;
}
