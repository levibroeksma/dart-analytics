import { numbersPath } from "@modules/game/board-progression.module";
import type { OracleEngine } from "./engine-oracle";
import { aimedOnPath } from "./aimed-observations";
import type { DartObservation } from "@modules/types";

/**
 * 55 % a dart on the active seat's own target, in any ring (keypad SINGLE
 * included), otherwise `randomObservation`. Enough on-target darts that
 * HARD/EXTREME seats survive visits and reach BULL.
 */
export function aimedSinglesObservation(config: {
  targetOrder: readonly number[];
}): (rand: () => number, engine: OracleEngine) => DartObservation {
  return aimedOnPath(numbersPath(config.targetOrder), 0.55);
}
