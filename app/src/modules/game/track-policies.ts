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
