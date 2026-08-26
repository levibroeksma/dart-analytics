import { BULL_TARGET_NUMBER } from "@modules/game/board-progression.module";
import { playPreviewSegments } from "@lib/game/play-lifecycle";
import type { BoardTarget, DartObservation, TurnFact } from "@modules/types";
import type { PreviewSegment } from "@lib/types";

/** Shared by Bob's 27 and Doubles Training — both walk the same
 * BULL-terminated numeric doubles path (`doublesPath()`). */
export function doublesPathTargetLabel(target: BoardTarget): string {
  return target.kind === "BULL" ? "BULL" : `D${target.number}`;
}

export function doublesPathPreviewSegments(
  turns: readonly TurnFact[],
  hiddenTurnKey: string | null,
): PreviewSegment[] {
  return playPreviewSegments(turns, hiddenTurnKey, (dart) =>
    dart.hitTargetNumber === dart.intendedTargetNumber &&
    dart.hitZoneKey === dart.intendedZoneKey
      ? "hit"
      : "miss",
  );
}

/** The recreational tap row's hit/miss → `DartObservation` mapping for a
 * doubles-path target: a hit records DOUBLE (or INNER_BULL on the bull). */
export function doublesPathObservation(
  target: BoardTarget,
  hit: boolean,
): DartObservation {
  return hit
    ? {
        hitTargetNumber:
          target.kind === "BULL" ? BULL_TARGET_NUMBER : target.number,
        hitZoneKey: target.kind === "BULL" ? "INNER_BULL" : "DOUBLE",
        locationX: null,
        locationY: null,
      }
    : {
        hitTargetNumber: null,
        hitZoneKey: "MISS",
        locationX: null,
        locationY: null,
      };
}
