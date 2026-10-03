import type { CheckoutVisitDarts, DartFact, HighestCheckout } from "./types";

/** The zones a checkout can legally land in; shared with `bust-rate.module.ts`'s `endedOnDouble` gate. */
export const FINISHING_ZONES: ReadonlySet<DartFact["hitZoneKey"]> = new Set([
  "DOUBLE",
  "INNER_BULL",
]);

/** Whether `dart`, thrown at `remaining`, is a legal checkout of it. */
export function isFinishingDart(remaining: number, dart: DartFact): boolean {
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
 * module's classifier. `sessionId` is the session of the first visit, in
 * input order, that finished at the highest value (#638).
 */
export function highestCheckout(
  visits: readonly (CheckoutVisitDarts & { sessionId?: string })[],
): HighestCheckout | null {
  const finishes: { value: number; sessionId: string | null }[] = [];
  for (const visit of visits) {
    let remaining = visit.startingRemaining;
    for (const dart of visit.darts) {
      if (isFinishingDart(remaining, dart)) {
        finishes.push({
          value: visit.startingRemaining,
          sessionId: visit.sessionId ?? null,
        });
        break;
      }
      remaining -= dart.score;
    }
  }
  if (finishes.length === 0) return null;
  const value = Math.max(...finishes.map((finish) => finish.value));
  const top = finishes.filter((finish) => finish.value === value);
  return { value, timesHit: top.length, sessionId: top[0]!.sessionId };
}
