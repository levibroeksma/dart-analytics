import { BULL_TARGET_NUMBER, targetAt } from "./board-progression.module";
import type {
  BoardTarget,
  DartObservation,
  DartZoneKey,
  PointsTable,
  TrackSeat,
} from "./types";

/** Target policy: the path entry at the seat's `targetIndex`. */
export function pathTarget<TExt>(
  path: readonly BoardTarget[],
): (seat: TrackSeat<TExt>) => BoardTarget {
  return (seat) => targetAt(path, seat.targetIndex);
}

/** Points policy for rulesets that score nothing per dart. */
export function noPoints(): number {
  return 0;
}

/** Visit policy: open until a dart hits or `darts` darts are thrown. */
export function closeOnHitOrAfter<TExt>(
  darts: number,
): (seat: TrackSeat<TExt>) => boolean {
  return (seat) => seat.hitsThisVisit === 0 && seat.dartsThisVisit < darts;
}

/** Visit-close policy: step to the next target, or finish (`DONE`, index kept) at `lastIndex`. */
export function advanceToEnd<TExt>(
  lastIndex: number,
): (seat: TrackSeat<TExt>) => TrackSeat<TExt> {
  return (seat) =>
    seat.targetIndex === lastIndex
      ? { ...seat, status: "DONE" }
      : { ...seat, targetIndex: seat.targetIndex + 1 };
}

/** Visit policy: open until `darts` darts are thrown, hits or not. */
export function closeAfter<TExt>(
  darts: number,
): (seat: TrackSeat<TExt>) => boolean {
  return (seat) => seat.dartsThisVisit < darts;
}

/** Visit-close policy: subtract `penalty(seat)` from the score when the visit hit nothing. */
export function penaltyOnBlank<TExt>(
  penalty: (seat: TrackSeat<TExt>) => number,
): (seat: TrackSeat<TExt>) => TrackSeat<TExt> {
  return (seat) =>
    seat.hitsThisVisit === 0
      ? { ...seat, score: seat.score - penalty(seat) }
      : seat;
}

/** Visit-close policy: a score at or below zero puts the seat `OUT`. */
export function outAtOrBelowZero<TExt>(seat: TrackSeat<TExt>): TrackSeat<TExt> {
  return seat.score <= 0 ? { ...seat, status: "OUT" } : seat;
}

const ANY_RING: ReadonlySet<DartZoneKey> = new Set([
  "SINGLE",
  "INNER_SINGLE",
  "OUTER_SINGLE",
  "DOUBLE",
  "TREBLE",
]);

const EITHER_BULL: ReadonlySet<DartZoneKey> = new Set([
  "OUTER_BULL",
  "INNER_BULL",
]);

/** The board number a target's darts must land on: its own number, or 25 for BULL. */
function sectionOf(target: BoardTarget): number {
  return target.kind === "BULL" ? BULL_TARGET_NUMBER : target.number;
}

/** Hit policy: any ring on a NUMBER target's number, either bull on BULL. */
export function anyRingEitherBull(
  target: BoardTarget,
  observation: DartObservation,
): boolean {
  const zones = target.kind === "BULL" ? EITHER_BULL : ANY_RING;
  return (
    observation.hitTargetNumber === sectionOf(target) &&
    zones.has(observation.hitZoneKey)
  );
}

/** Points policy: the target kind's row of `table` for the dart's zone, 0 off the target's section. */
export function pointsTable(
  table: PointsTable,
): (target: BoardTarget, observation: DartObservation) => number {
  return (target, observation) => {
    if (observation.hitTargetNumber !== sectionOf(target)) return 0;
    const row = target.kind === "BULL" ? table.bull : table.number;
    return row[observation.hitZoneKey] ?? 0;
  };
}

/** Visit-close policy: a visit with fewer than `hits` hits puts the seat `OUT`. */
export function outBelowHits<TExt>(
  hits: number,
): (seat: TrackSeat<TExt>) => TrackSeat<TExt> {
  return (seat) =>
    seat.hitsThisVisit < hits ? { ...seat, status: "OUT" } : seat;
}
