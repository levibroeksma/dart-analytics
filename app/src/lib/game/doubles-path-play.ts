import { BULL_TARGET_NUMBER } from "@modules/game/board-progression.module";
import type { BoardTarget, DartObservation, TurnFact } from "@modules/types";

type DoublesPathPreviewSegment = {
  status: "hit" | "miss" | "empty";
};

/** Shared by Bob's 27 and Doubles Training — both walk the same
 * BULL-terminated numeric doubles path (`doublesPath()`). */
export function doublesPathTargetLabel(target: BoardTarget): string {
  return target.kind === "BULL" ? "BULL" : `D${target.number}`;
}

const EMPTY_SEGMENTS: readonly DoublesPathPreviewSegment[] = [
  { status: "empty" },
  { status: "empty" },
  { status: "empty" },
];

export function doublesPathPreviewSegments(
  turns: readonly TurnFact[],
  hiddenTurnKey: string | null,
): DoublesPathPreviewSegment[] {
  const lastTurn = turns.at(-1);
  if (!lastTurn || lastTurn.clientKey === hiddenTurnKey) {
    return [...EMPTY_SEGMENTS];
  }
  return [0, 1, 2].map((i) => {
    const dart = lastTurn.darts[i];
    if (!dart) return { status: "empty" };
    const onTarget =
      dart.hitTargetNumber === dart.intendedTargetNumber &&
      dart.hitZoneKey === dart.intendedZoneKey;
    return { status: onTarget ? "hit" : "miss" };
  });
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
