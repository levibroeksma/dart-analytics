import type { KillerSeatResult, SeatFact } from "@lib/types";
import type { KillerSeatState } from "@modules/types";

/** Returns a copy of `numbers`; starterIndex 1 swaps the two entries so the starter takes the second number. */
export function starterFirstNumbers(
  numbers: readonly number[],
  starterIndex: 0 | 1,
): number[] {
  const copy = [...numbers];
  if (starterIndex === 1) copy.reverse();
  return copy;
}

/** Projects one folded Killer seat to its stored result row. */
export function killerSeatResult(seat: KillerSeatState): KillerSeatResult {
  return {
    participantRef: seat.participantRef,
    sideKey: seat.sideKey,
    number: seat.number,
    livesLeft: seat.lives,
    livesTaken: seat.livesTaken,
    dartsToKiller: seat.dartsToKiller,
    out: seat.out,
  };
}

/** Display names of the out seats in elimination order, joined with " → "; empty when none are out. */
export function outOrderNames(
  outOrder: readonly string[],
  seats: readonly SeatFact[],
): string {
  return outOrder
    .map(
      (ref) => seats.find((s) => s.participantRef === ref)?.displayName ?? ref,
    )
    .join(" → ");
}
