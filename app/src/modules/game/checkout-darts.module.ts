import { checkoutPathFor } from "./checkout-path.module";
import type { CheckoutDartOptions, DartCount } from "./types";

/**
 * The fewest darts that can finish `remainingScore`, read off the checkout
 * chart. A score with no finish route — a bogey number, anything above 170 —
 * has no shorter answer than the whole visit, so it reports `maxDarts`: the
 * player claiming a checkout there is claiming something the chart cannot
 * describe, and offering them a one-dart answer would be a wrong hint rather
 * than a permissive one.
 */
function minimumDarts(remainingScore: number, maxDarts: number): number {
  return checkoutPathFor(remainingScore)?.length ?? maxDarts;
}

function range(from: number, to: number): DartCount[] {
  const counts: DartCount[] = [];
  for (let n = from; n <= to; n += 1) {
    counts.push(n as DartCount);
  }
  return counts;
}

/**
 * Which dart counts the checkout confirm may offer for `remainingScore`.
 *
 * A visit that finishes in the chart's minimum has thrown exactly one dart at
 * a double; every dart beyond that minimum is one the player may have spent
 * bouncing off the double, so the two lists move against each other — 41 needs
 * two darts, so it finishes in two or three and lands one or two at a double,
 * while 170 needs all three and can only ever have thrown one.
 */
export function checkoutDartOptions(
  remainingScore: number,
  maxDarts: number,
): CheckoutDartOptions {
  const minimum = minimumDarts(remainingScore, maxDarts);
  return {
    toFinish: range(minimum, maxDarts),
    atDouble: range(1, maxDarts - minimum + 1),
  };
}

/**
 * Why a reported checkout's dart counts are impossible for `remainingScore`,
 * or null when they are consistent with it. An unreported count is never
 * rejected: the counts are optional everywhere they are accepted, and a caller
 * that does not collect them is recording exactly what it recorded before they
 * existed.
 */
export function checkoutDartsRejection(
  remainingScore: number,
  dartsUsed: DartCount | undefined,
  dartsAtDouble: DartCount | undefined,
  maxDarts: number,
): string | null {
  if (dartsUsed !== undefined) {
    if (dartsUsed > maxDarts) {
      return `A checkout uses at most ${maxDarts} darts.`;
    }
    const minimum = minimumDarts(remainingScore, maxDarts);
    if (dartsUsed < minimum) {
      return `Checking out ${remainingScore} takes at least ${minimum} darts.`;
    }
  }
  if (dartsAtDouble !== undefined) {
    const thrown = dartsUsed ?? maxDarts;
    if (dartsAtDouble > thrown) {
      return `A checkout cannot throw more darts at a double than the visit used.`;
    }
  }
  return null;
}
