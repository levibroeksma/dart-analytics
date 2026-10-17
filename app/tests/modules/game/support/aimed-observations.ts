import { targetAt } from "@modules/game/board-progression.module";
import { activeSeatState } from "@modules/game/seat-state.module";
import type { OracleEngine } from "./engine-oracle";
import type {
  BoardTarget,
  DartObservation,
  DartZoneKey,
  MultiSeatState,
  SeatState,
} from "@modules/types";

const RINGS: readonly DartZoneKey[] = [
  "SINGLE",
  "INNER_SINGLE",
  "OUTER_SINGLE",
  "DOUBLE",
  "TREBLE",
];

/**
 * A dart on the active seat's target along `path`: either bull ring on BULL
 * (one `rand()` draw), otherwise the number in the ring `numberZone` picks.
 */
export function onActiveTarget(
  engine: OracleEngine,
  path: readonly BoardTarget[],
  rand: () => number,
  numberZone: () => DartZoneKey,
): DartObservation {
  const state = engine.state() as MultiSeatState<
    SeatState & { targetIndex: number }
  >;
  const target = targetAt(path, activeSeatState(state).targetIndex);
  const base = { locationX: null, locationY: null };
  if (target.kind === "BULL")
    return {
      ...base,
      hitTargetNumber: 25,
      hitZoneKey: rand() < 0.5 ? "OUTER_BULL" : "INNER_BULL",
    };
  return { ...base, hitTargetNumber: target.number, hitZoneKey: numberZone() };
}

/** Any of the five number rings, one `rand()` draw. */
export function anyRing(rand: () => number): DartZoneKey {
  return RINGS[Math.floor(rand() * RINGS.length)]!;
}
