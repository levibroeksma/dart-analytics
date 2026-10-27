import type { DartObservation } from "@modules/types";
import { randomObservation, type OracleEngine } from "./engine-oracle";

const BASE = { locationX: null, locationY: null };

/** The dart that finishes `remaining`, or the set-up shot towards a double. */
function finishingShot(remaining: number): DartObservation {
  if (remaining === 50)
    return { ...BASE, hitTargetNumber: 25, hitZoneKey: "INNER_BULL" };
  if (remaining <= 40 && remaining % 2 === 0)
    return { ...BASE, hitTargetNumber: remaining / 2, hitZoneKey: "DOUBLE" };
  if (remaining > 60)
    return { ...BASE, hitTargetNumber: 20, hitZoneKey: "TREBLE" };
  const single = remaining > 40 ? remaining - 40 : 1;
  return { ...BASE, hitTargetNumber: single, hitZoneKey: "OUTER_SINGLE" };
}

/**
 * With probability `rate`, throws towards a double-out of the engine's
 * current `remaining`; otherwise a random board hit — so checkouts, busts
 * and spent visits all occur.
 */
export function towardCheckout(rate: number) {
  return (rand: () => number, engine: OracleEngine): DartObservation => {
    const remaining = (engine.state() as { remaining?: number }).remaining ?? 0;
    if (rand() >= rate || remaining <= 1) return randomObservation(rand);
    return finishingShot(remaining);
  };
}
