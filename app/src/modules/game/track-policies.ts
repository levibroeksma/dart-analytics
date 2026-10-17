import { targetAt } from "./board-progression.module";
import type { BoardTarget, TrackSeat } from "./types";

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
