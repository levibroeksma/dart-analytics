import { rulesOf } from "@modules/game/around-the-clock.engine.module";
import { randomObservation, type OracleEngine } from "./engine-oracle";
import { anyRing, onActiveTarget } from "./aimed-observations";
import type { AroundTheClockEngineConfig } from "@lib/types";
import type { DartObservation } from "@modules/types";

/**
 * 70 % a dart on the active seat's target, otherwise `randomObservation`.
 * Under OUTER_SINGLE, 70 % of on-target number darts take the outer single.
 * Enough on-target darts that HARD/PRO seats reach BULL, and Easy timed runs lap.
 */
export function aimedClockObservation(
  config: AroundTheClockEngineConfig,
): (rand: () => number, engine: OracleEngine) => DartObservation {
  const { path, segmentRule } = rulesOf(config);
  return (rand, engine) => {
    if (rand() >= 0.7) return randomObservation(rand);
    return onActiveTarget(engine, path, rand, () =>
      segmentRule === "OUTER_SINGLE" && rand() < 0.7
        ? "OUTER_SINGLE"
        : anyRing(rand),
    );
  };
}
