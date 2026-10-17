import { targetAt } from "@modules/game/board-progression.module";
import { rulesOf } from "@modules/game/around-the-clock.engine.module";
import { activeSeatState } from "@modules/game/seat-state.module";
import { randomObservation, type OracleEngine } from "./engine-oracle";
import type { AroundTheClockEngineConfig } from "@lib/types";
import type {
  AroundTheClockState,
  DartObservation,
  DartZoneKey,
} from "@modules/types";

const RINGS: readonly DartZoneKey[] = [
  "SINGLE",
  "INNER_SINGLE",
  "OUTER_SINGLE",
  "DOUBLE",
  "TREBLE",
];

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
    const seat = activeSeatState(engine.state() as AroundTheClockState);
    const target = targetAt(path, seat.targetIndex);
    const base = { locationX: null, locationY: null };
    if (target.kind === "BULL")
      return {
        ...base,
        hitTargetNumber: 25,
        hitZoneKey: rand() < 0.5 ? "OUTER_BULL" : "INNER_BULL",
      };
    const zone =
      segmentRule === "OUTER_SINGLE" && rand() < 0.7
        ? "OUTER_SINGLE"
        : RINGS[Math.floor(rand() * RINGS.length)]!;
    return { ...base, hitTargetNumber: target.number, hitZoneKey: zone };
  };
}
