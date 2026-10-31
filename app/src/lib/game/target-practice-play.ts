import { BULL_TARGET_NUMBER } from "@modules/game/board-progression.module";
import type { BoardTarget, DartObservation } from "@modules/types";

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
