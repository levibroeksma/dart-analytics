import { SECTOR_ORDER } from "@lib/game/board/board-geometry.module";
import { resolveCheckoutAttempt } from "./checkout-bust.module";
import type {
  CheckoutVisitDarts,
  DartFact,
  DartOutcome,
  DartZoneKey,
} from "./types";

export type { CheckoutVisitDarts };

/** The rings a finishing dart can land in; a hit here is an attempt whatever it scored. */
const RING_ZONES: ReadonlySet<DartZoneKey> = new Set([
  "DOUBLE",
  "INNER_BULL",
  "OUTER_BULL",
]);

/** Everything that lands in a numbered sector rather than a finishing ring. */
const SECTOR_ZONES: ReadonlySet<DartZoneKey> = new Set([
  "SINGLE",
  "INNER_SINGLE",
  "OUTER_SINGLE",
  "TREBLE",
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

/**
 * One dart's classification against the remaining score it was thrown at.
 *
 * Order matters. A dart that busts the visit is always an attempt, because
 * no one lays up into a bust -- so the bust test runs before the rules that
 * let a legal sector hit off as a deliberate reroute. At `remaining === 50`
 * the inner bull is the required finish, the outer bull is its own near
 * miss, and the inner single band (which nobody aims at) is a missed bull;
 * the outer single band and the trebles there are ordinary setup shots. The
 * unbanded `SINGLE` key that keypad capture writes can never prove which
 * band it was, so it stays excluded at 50.
 */
export function classifyDart(remaining: number, dart: DartFact): DartOutcome {
  if (!isDirectlyFinishable(remaining)) return "NOT_ATTEMPT";

  const endedOnDouble =
    dart.hitZoneKey === "DOUBLE" || dart.hitZoneKey === "INNER_BULL";
  if (endedOnDouble && dart.score === remaining) return "HIT";
  if (RING_ZONES.has(dart.hitZoneKey)) return "MISS";
  if (dart.hitZoneKey === "MISS") return "MISS";

  const { busted } = resolveCheckoutAttempt(remaining, dart.score, false);
  if (busted) return "MISS";

  if (remaining === 50) {
    return dart.hitZoneKey === "INNER_SINGLE" ? "MISS" : "NOT_ATTEMPT";
  }

  if (SECTOR_ZONES.has(dart.hitZoneKey) && dart.hitTargetNumber !== null) {
    return isBoardAdjacentOrSame(dart.hitTargetNumber, remaining / 2)
      ? "MISS"
      : "NOT_ATTEMPT";
  }

  return "NOT_ATTEMPT";
}

/**
 * Classifies every dart across `visits` as a checkout-attempt hit, miss, or
 * not an attempt at all (a deliberate lay-up/reroute) -- see
 * `docs/superpowers/specs/2026-09-19-x01-checkout-percentage-design.md` for
 * the full rule and its ten reference darts.
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
