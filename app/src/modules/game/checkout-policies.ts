import { resolveCheckoutAttempt } from "./checkout-bust.module";
import { isCheckoutReachable } from "./checkout-reachability.module";
import { seededUniform } from "./seeded-rng.module";
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

/**
 * `dartWalkJudge`, except an open visit fails the moment its remainder can
 * no longer be finished with the darts it has left (#1064). No later dart
 * of such a visit can check out, so judging the walk's verdict is exact.
 */
export function unreachableFails<TExt>(
  seat: CheckoutSeat<TExt>,
  turn: TurnFact,
): VisitVerdict {
  const verdict = dartWalkJudge(seat, turn);
  if (verdict.kind !== "OPEN" || verdict.darts === 0) return verdict;
  return isCheckoutReachable(verdict.remaining, DARTS_PER_VISIT - verdict.darts)
    ? verdict
    : { kind: "FAIL" };
}

/**
 * A uniform pick from `pool` keyed by `(drawSeed, index)` alone, never by
 * earlier darts, so undo and replay redraw it exactly.
 */
export function seededPoolDraw(
  drawSeed: number,
  pool: readonly number[],
  index: number,
): number {
  const uniform = seededUniform(drawSeed, index)();
  return pool[Math.floor(uniform * pool.length)];
}

/** Next target: the seeded draw for the attempt after the one closing. */
export function seededDrawTarget(
  drawSeed: number,
  pool: readonly number[],
): <TExt>(seat: CheckoutSeat<TExt>) => number {
  return (seat) => seededPoolDraw(drawSeed, pool, seat.attemptIndex + 1);
}
