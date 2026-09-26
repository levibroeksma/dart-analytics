import { formatTargetKey } from "@lib/stats/target-key";
import type { IntentZoneKey, TargetKey } from "@lib/types";
import type { IntentCellRow } from "@modules/types";

/** The intended pair as a `TargetKey` (phase-2 decision 5). */
export function intendedKey(
  row: Pick<IntentCellRow, "intendedTargetNumber" | "intendedZoneKey">,
): TargetKey {
  return formatTargetKey(
    row.intendedTargetNumber,
    row.intendedZoneKey as IntentZoneKey,
  );
}

/** The landing pair as a hit key: `MISS`, or a `TargetKey`. */
export function hitKey(
  row: Pick<IntentCellRow, "hitTargetNumber" | "hitZoneKey">,
): string {
  if (row.hitZoneKey === "MISS") return "MISS";
  return formatTargetKey(
    row.hitTargetNumber as number,
    row.hitZoneKey as IntentZoneKey,
  );
}

/**
 * Whether a dart landed exactly on its intended pair — parity-tested against
 * `isHitOn` (`board-progression.module.ts`) for every intent Doubles
 * Training and Bob's 27 store (phase-2 decision 2).
 */
export function isHit(
  row: Pick<
    IntentCellRow,
    | "intendedTargetNumber"
    | "intendedZoneKey"
    | "hitTargetNumber"
    | "hitZoneKey"
  >,
): boolean {
  return (
    row.hitTargetNumber === row.intendedTargetNumber &&
    row.hitZoneKey === row.intendedZoneKey
  );
}
