import {
  formatTargetKey,
  isAimHit,
  parseTargetKey,
} from "@lib/stats/target-key";
import { aimedDarts } from "../derived-aims.module";
import type { IntentZoneKey, TargetKey } from "@lib/types";
import type { DartZoneKey, IntentCellRow, SessionSteps } from "@modules/types";

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
 * Whether a dart landed on its intended aim — `isAimHit` (phase-4 decision
 * 2): a `NUMBER`/`BULL` derived aim resolves by ring or by either bull, and
 * every stored zone keeps the exact-pair rule `isHit` always used, parity-
 * tested against `isHitOn` (`board-progression.module.ts`) for every intent
 * Doubles Training and Bob's 27 store (phase-2 decision 2).
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
  return isAimHit(
    {
      number: row.intendedTargetNumber,
      zone: row.intendedZoneKey as IntentZoneKey,
    },
    { number: row.hitTargetNumber, zone: row.hitZoneKey as DartZoneKey },
  );
}

/**
 * Aggregates `aimedDarts` across `sessions` into `IntentCellRow`s, one row
 * per bucket × intended aim × landing triple (phase-4 decisions 1-2):
 * `intendedZoneKey` carries `NUMBER`/`BULL` for these derived aims, so every
 * phase-2 shape function already folding `IntentCellRow[]`
 * (`target-accuracy`, `confusion`) serves them unchanged.
 */
export function aimCellRows(
  sessions: readonly SessionSteps<unknown>[],
): IntentCellRow[] {
  const cells = new Map<string, IntentCellRow>();

  for (const session of sessions) {
    for (const dart of aimedDarts(session)) {
      const aim = parseTargetKey(dart.aim);
      if (aim === null) continue;

      const key = [
        session.bucketStart,
        aim.zone,
        aim.number,
        dart.hitZone,
        dart.hitNumber,
      ].join("|");

      const existing = cells.get(key);
      if (existing) {
        existing.darts += 1;
        continue;
      }
      cells.set(key, {
        bucketStart: session.bucketStart,
        bucketEnd: session.bucketEnd,
        intendedTargetNumber: aim.number,
        intendedZoneKey: aim.zone,
        hitTargetNumber: dart.hitNumber,
        hitZoneKey: dart.hitZone,
        darts: 1,
      });
    }
  }

  return Array.from(cells.values());
}
