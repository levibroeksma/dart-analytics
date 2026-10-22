import { targetAt } from "@modules/game/board-progression.module";
import { activeSeatState } from "@modules/game/seat-state.module";
import { randomObservation, type OracleEngine } from "./engine-oracle";
import type {
  BoardTarget,
  TrackTarget,
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
 * A dart on `target`: either bull ring on BULL (one `rand()` draw),
 * a random number in its ring for a zone target, otherwise the number in the
 * ring `numberZone` picks.
 */
function observationOn(
  target: TrackTarget,
  rand: () => number,
  numberZone: () => DartZoneKey,
): DartObservation {
  const base = { locationX: null, locationY: null };
  if (target.kind === "ANY_DOUBLE" || target.kind === "ANY_TREBLE")
    return {
      ...base,
      hitTargetNumber: 1 + Math.floor(rand() * 20),
      hitZoneKey: target.kind === "ANY_DOUBLE" ? "DOUBLE" : "TREBLE",
    };
  if (target.kind === "BULL")
    return {
      ...base,
      hitTargetNumber: 25,
      hitZoneKey: rand() < 0.5 ? "OUTER_BULL" : "INNER_BULL",
    };
  return { ...base, hitTargetNumber: target.number, hitZoneKey: numberZone() };
}

/** A dart on the active seat's target along `path`; see `observationOn`. */
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
  return observationOn(target, rand, numberZone);
}

/** Any of the five number rings, one `rand()` draw. */
export function anyRing(rand: () => number): DartZoneKey {
  return RINGS[Math.floor(rand() * RINGS.length)]!;
}

/**
 * `rate` of darts on the active seat's target along `path`, in any ring
 * (either bull on BULL), otherwise `randomObservation`.
 */
export function aimedOnPath(
  path: readonly BoardTarget[],
  rate: number,
): (rand: () => number, engine: OracleEngine) => DartObservation {
  return (rand, engine) => {
    if (rand() >= rate) return randomObservation(rand);
    return onActiveTarget(engine, path, rand, () => anyRing(rand));
  };
}

/**
 * `rate` of darts on an exercise's `currentTargetNumber`, in any ring
 * (either bull on 25), otherwise `randomObservation`.
 */
export function aimedOnCurrentTarget(
  rate: number,
): (rand: () => number, engine: OracleEngine) => DartObservation {
  return (rand, engine) => {
    if (rand() >= rate) return randomObservation(rand);
    const { currentTargetNumber } = engine.state() as {
      currentTargetNumber: number;
    };
    const target: BoardTarget =
      currentTargetNumber === 25
        ? { kind: "BULL" }
        : { kind: "NUMBER", number: currentTargetNumber };
    return observationOn(target, rand, () => anyRing(rand));
  };
}

/**
 * `rate` of darts on an exercise's board target in state field `field`
 * (default `currentTarget`), in the ring `ring` picks (any ring by default;
 * either bull on BULL), otherwise `randomObservation`.
 */
export function aimedOnCurrentBoardTarget(
  rate: number,
  field = "currentTarget",
  ring: (rand: () => number) => DartZoneKey = anyRing,
): (rand: () => number, engine: OracleEngine) => DartObservation {
  return (rand, engine) => {
    if (rand() >= rate) return randomObservation(rand);
    const target = (engine.state() as Record<string, TrackTarget>)[field];
    return observationOn(target, rand, () => ring(rand));
  };
}
