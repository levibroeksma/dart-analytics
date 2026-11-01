import { BULL_TARGET_NUMBER } from "@modules/game/board-progression.module";
import type { BoardTarget, DartObservation, TurnFact } from "@modules/types";

/** A recreational tap row's ring button. */
type TapRing = "SINGLE" | "DOUBLE" | "TREBLE" | "MISS";

/**
 * The dart one ring tap stands for on `target`, or null for a TREBLE tap on
 * the bull, which has no treble. A MISS carries no target number; on the bull
 * SINGLE is the outer bull and DOUBLE the inner one; any other target takes
 * the tapped ring as-is. A tap never knows where the dart landed, so the
 * coordinates are null.
 */
export function ringTapObservation(
  target: BoardTarget,
  ring: TapRing,
): DartObservation | null {
  if (ring === "MISS") {
    return {
      hitTargetNumber: null,
      hitZoneKey: "MISS",
      locationX: null,
      locationY: null,
    };
  }
  if (target.kind === "BULL") {
    if (ring === "TREBLE") return null;
    return {
      hitTargetNumber: BULL_TARGET_NUMBER,
      hitZoneKey: ring === "SINGLE" ? "OUTER_BULL" : "INNER_BULL",
      locationX: null,
      locationY: null,
    };
  }
  return {
    hitTargetNumber: target.number,
    hitZoneKey: ring,
    locationX: null,
    locationY: null,
  };
}

/**
 * The round index of the last turn within its own seat's turns; 0 before any
 * turn. A 1v1 session interleaves both seats' turns, so `turns.length - 1`
 * is wrong there.
 */
export function lastTurnSeatRound(turns: readonly TurnFact[]): number {
  const lastTurn = turns.at(-1);
  return lastTurn
    ? turns.filter((turn) => turn.participantRef === lastTurn.participantRef)
        .length - 1
    : 0;
}
