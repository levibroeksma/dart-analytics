import { numbersPath, targetAt } from "@modules/game/board-progression.module";
import { activeSeatState } from "@modules/game/seat-state.module";
import { randomObservation, type OracleEngine } from "./engine-oracle";
import type {
  DartObservation,
  DartZoneKey,
  SinglesTrainingState,
} from "@modules/types";

const RINGS: readonly DartZoneKey[] = [
  "SINGLE",
  "INNER_SINGLE",
  "OUTER_SINGLE",
  "DOUBLE",
  "TREBLE",
];

/**
 * 55 % a dart on the active seat's own target, in any ring (keypad SINGLE
 * included), otherwise `randomObservation`. Enough on-target darts that
 * HARD/EXTREME seats survive visits and reach BULL.
 */
export function aimedSinglesObservation(config: {
  targetOrder: readonly number[];
}): (rand: () => number, engine: OracleEngine) => DartObservation {
  const path = numbersPath(config.targetOrder);
  return (rand, engine) => {
    if (rand() >= 0.55) return randomObservation(rand);
    const seat = activeSeatState(engine.state() as SinglesTrainingState);
    const target = targetAt(path, seat.targetIndex);
    const base = { locationX: null, locationY: null };
    if (target.kind === "BULL")
      return {
        ...base,
        hitTargetNumber: 25,
        hitZoneKey: rand() < 0.5 ? "OUTER_BULL" : "INNER_BULL",
      };
    return {
      ...base,
      hitTargetNumber: target.number,
      hitZoneKey: RINGS[Math.floor(rand() * RINGS.length)]!,
    };
  };
}
