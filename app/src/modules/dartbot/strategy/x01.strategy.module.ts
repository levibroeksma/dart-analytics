import type { X01View } from "@modules/interfaces";
import type { DartZoneKey, ThrowIntent } from "@modules/types";

/** Real darts strategy's default scoring target outside checkout range, and
 * every tier's target when the decision axis is too low to trust a route. */
const SCORING_TARGET: ThrowIntent = { targetNumber: 20, zoneKey: "TREBLE" };

/**
 * The decision axis (`08-DartBot.md` §Decision degrades too) below which the
 * bot never attempts a checkout route — "always the biggest number... takes
 * a double only if one happens to land." At and above it, the bot follows
 * `checkoutPathFor()`'s own route whenever one exists.
 */
const ROUTES_CHECKOUT_ABOVE = 30;

/** `BULL` (50, inner) mirrors `dictated.strategy.module.ts`'s own local
 * literal — `modules/dartbot/*` may not import `board-progression.module`. */
const INNER_BULL_TARGET_NUMBER = 25;

function intentForCheckoutLabel(label: string): ThrowIntent {
  if (label === "BULL") {
    return { targetNumber: INNER_BULL_TARGET_NUMBER, zoneKey: "INNER_BULL" };
  }
  if (label === "25") {
    return { targetNumber: 25, zoneKey: "OUTER_BULL" };
  }
  const treble = /^T(\d+)$/.exec(label);
  if (treble) {
    return { targetNumber: Number(treble[1]), zoneKey: "TREBLE" };
  }
  const double = /^D(\d+)$/.exec(label);
  if (double) {
    return { targetNumber: Number(double[1]), zoneKey: "DOUBLE" };
  }
  return {
    targetNumber: Number(label),
    zoneKey: "OUTER_SINGLE" as DartZoneKey,
  };
}

/**
 * Aims at the current checkout route's first step when the decision axis
 * trusts one and one exists, otherwise at treble 20 — the same fallback for
 * "not in range," "no route (a bogey number)," and "decision quality too
 * low to route at all." `view.checkoutPath` is re-derived by the caller
 * before every dart from whatever `remaining` actually is, so a miss that
 * changes the remaining score is picked up on the very next call with no
 * state held here or in the caller across a visit.
 */
export function chooseTarget(
  view: X01View,
  decisionQuality: number,
): ThrowIntent {
  if (decisionQuality < ROUTES_CHECKOUT_ABOVE) return SCORING_TARGET;
  if (!view.checkoutPath || view.checkoutPath.length === 0)
    return SCORING_TARGET;
  return intentForCheckoutLabel(view.checkoutPath[0]!);
}
