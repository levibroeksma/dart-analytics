import type { CheckoutVisitDarts, DartFact, HighestCheckout } from "./types";

const FINISHING_ZONES: ReadonlySet<DartFact["hitZoneKey"]> = new Set([
  "DOUBLE",
  "INNER_BULL",
]);

function isFinishingDart(remaining: number, dart: DartFact): boolean {
  return FINISHING_ZONES.has(dart.hitZoneKey) && dart.score === remaining;
}

/**
 * The largest visit (turn) any checkout successfully finished, and how many
 * times that exact value was hit. A checkout's value is the visit's
 * `startingRemaining` -- the whole score that visit closed out, not the
 * local remaining before whichever dart landed the double/bull (a 170
 * finish, e.g., is T20/T20/bullseye, valued at 170, not the 50 the final
 * dart alone closed). Walks the same `CheckoutVisitDarts` shape
 * `double-attempt.module.ts` classifies, independently -- this measures the
 * finish value itself, not a hit/miss tally, so it does not share that
 * module's classifier.
 */
export function highestCheckout(
  visits: readonly CheckoutVisitDarts[],
): HighestCheckout | null {
  const finishes: number[] = [];
  for (const visit of visits) {
    let remaining = visit.startingRemaining;
    for (const dart of visit.darts) {
      if (isFinishingDart(remaining, dart)) {
        finishes.push(visit.startingRemaining);
        break;
      }
      remaining -= dart.score;
    }
  }
  if (finishes.length === 0) return null;
  const value = Math.max(...finishes);
  const timesHit = finishes.filter((finish) => finish === value).length;
  return { value, timesHit };
}
