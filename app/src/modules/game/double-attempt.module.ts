import { SECTOR_ORDER } from "@lib/game/board/board-geometry.module";
import type { CheckoutVisitDarts, DartFact, DartZoneKey } from "./types";

export type { CheckoutVisitDarts };

const SINGLE_OR_TREBLE: ReadonlySet<DartZoneKey> = new Set([
  "SINGLE",
  "INNER_SINGLE",
  "OUTER_SINGLE",
  "TREBLE",
]);

const DOUBLE_OR_BULL: ReadonlySet<DartZoneKey> = new Set([
  "DOUBLE",
  "INNER_BULL",
  "OUTER_BULL",
]);

/**
 * Whether `remaining` could be finished by one dart alone -- the exact set
 * of "this could have been the last dart" states, with no route/chart
 * lookup: every dart that actually finishes a double-out leg satisfies this
 * by construction (an even number a double can reach, or the bull).
 */
function isDirectlyFinishable(remaining: number): boolean {
  if (remaining === 50) return true;
  return remaining % 2 === 0 && remaining >= 2 && remaining <= 40;
}

/** Whether board segments `a` and `b` are the same segment or immediate neighbours. */
function isBoardAdjacentOrSame(a: number, b: number): boolean {
  if (a === b) return true;
  const size = SECTOR_ORDER.length;
  const indexA = SECTOR_ORDER.indexOf(a);
  const indexB = SECTOR_ORDER.indexOf(b);
  if (indexA < 0 || indexB < 0) return false;
  const diff = (indexA - indexB + size) % size;
  return diff === 1 || diff === size - 1;
}

type DartOutcome = "HIT" | "MISS" | "NOT_ATTEMPT";

/**
 * One dart's classification against the remaining score it was thrown at.
 * `remaining === 50` treats the inner bull as "the required double" and the
 * outer bull as its own near-miss zone; every other eligible remaining
 * treats `remaining / 2` as the required double's segment number.
 */
function classifyDart(remaining: number, dart: DartFact): DartOutcome {
  if (!isDirectlyFinishable(remaining)) return "NOT_ATTEMPT";

  if (DOUBLE_OR_BULL.has(dart.hitZoneKey)) {
    return dart.score === remaining ? "HIT" : "MISS";
  }

  if (remaining === 50) return "NOT_ATTEMPT";

  if (SINGLE_OR_TREBLE.has(dart.hitZoneKey) && dart.hitTargetNumber !== null) {
    const requiredSegment = remaining / 2;
    return isBoardAdjacentOrSame(dart.hitTargetNumber, requiredSegment)
      ? "MISS"
      : "NOT_ATTEMPT";
  }

  return "NOT_ATTEMPT";
}

/**
 * Classifies every dart across `visits` as a checkout-attempt hit, miss, or
 * not an attempt at all (a deliberate lay-up/reroute, or an unprovable
 * bounce-out) -- see `docs/superpowers/specs/2026-09-05-double-out-checkout-accuracy-design.md`
 * for the full rule and worked examples.
 */
export function classifyDoubleAttempts(visits: readonly CheckoutVisitDarts[]): {
  hits: number;
  misses: number;
} {
  let hits = 0;
  let misses = 0;

  for (const visit of visits) {
    let remaining = visit.startingRemaining;
    for (const dart of visit.darts) {
      const outcome = classifyDart(remaining, dart);
      if (outcome === "HIT") hits += 1;
      else if (outcome === "MISS") misses += 1;
      remaining -= dart.score;
    }
  }

  return { hits, misses };
}
