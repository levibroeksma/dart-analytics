import { SECTOR_ORDER } from "@lib/game/board/board-geometry.module";
import { isAimHit } from "@lib/stats/target-key";
import { intendedKey } from "./intent-cells.module";
import { isClosed } from "./series.module";
import type { IntentZoneKey, SeriesBucket } from "@lib/types";
import type {
  DartZoneKey,
  IntentCellRow,
  LooseDartsMetrics,
} from "@modules/types";

/**
 * Ring adjacency for the "neighbouring ring, same sector" near-miss case
 * (phase-2 decision 9). `INNER_BULL`/`OUTER_BULL` are handled separately —
 * they have no sector.
 */
const RING_ORDER: readonly DartZoneKey[] = [
  "INNER_SINGLE",
  "TREBLE",
  "OUTER_SINGLE",
  "DOUBLE",
];

function neighborSectors(number: number): readonly number[] {
  const index = SECTOR_ORDER.indexOf(number);
  const n = SECTOR_ORDER.length;
  return [SECTOR_ORDER[(index - 1 + n) % n]!, SECTOR_ORDER[(index + 1) % n]!];
}

function ringAdjacent(a: DartZoneKey, b: DartZoneKey): boolean {
  const ia = RING_ORDER.indexOf(a);
  const ib = RING_ORDER.indexOf(b);
  if (ia < 0 || ib < 0) return false;
  return Math.abs(ia - ib) === 1;
}

/** `classifyLanding` under a `NUMBER:n` aim (phase-4 decision 8). */
function classifyNumberAim(
  intended: { number: number; zone: IntentZoneKey },
  hit: { number: number | null; zone: DartZoneKey },
): "onTarget" | "nearMiss" | "loose" {
  if (isAimHit(intended, hit)) return "onTarget";
  return hit.number !== null &&
    neighborSectors(intended.number).includes(hit.number)
    ? "nearMiss"
    : "loose";
}

/** `classifyLanding` under a `BULL:25` aim (phase-4 decision 8). */
function classifyBullAim(hit: {
  number: number | null;
  zone: DartZoneKey;
}): "onTarget" | "nearMiss" | "loose" {
  if (hit.zone === "OUTER_BULL" || hit.zone === "INNER_BULL") {
    return "onTarget";
  }
  return hit.zone === "INNER_SINGLE" ? "nearMiss" : "loose";
}

/** Near-miss check for a stored bull aim (`INNER_BULL`/`OUTER_BULL`): the other bull ring, same number. */
function nearMissOnStoredBull(
  intended: { number: number; zone: IntentZoneKey },
  hit: { number: number | null; zone: DartZoneKey },
): "nearMiss" | "loose" {
  const bullNear: DartZoneKey =
    intended.zone === "INNER_BULL" ? "OUTER_BULL" : "INNER_BULL";
  return hit.zone === bullNear && hit.number === intended.number
    ? "nearMiss"
    : "loose";
}

/** Near-miss check for a stored numbered-ring aim (phase-2 decision 9): neighbouring sector same ring, or neighbouring ring same sector. */
function nearMissOnStoredRing(
  intended: { number: number; zone: IntentZoneKey },
  hit: { number: number | null; zone: DartZoneKey },
): "nearMiss" | "loose" {
  if (hit.number === null) return "loose";

  const sameRingNeighborSector =
    hit.zone === intended.zone &&
    neighborSectors(intended.number).includes(hit.number);
  const sameSectorNeighborRing =
    hit.number === intended.number && ringAdjacent(intended.zone, hit.zone);

  return sameRingNeighborSector || sameSectorNeighborRing
    ? "nearMiss"
    : "loose";
}

/** `classifyLanding` under a stored-zone aim: exact pair, else phase-2 decision 9's adjacency. */
function classifyStoredAim(
  intended: { number: number; zone: IntentZoneKey },
  hit: { number: number | null; zone: DartZoneKey },
): "onTarget" | "nearMiss" | "loose" {
  if (hit.number === intended.number && hit.zone === intended.zone) {
    return "onTarget";
  }

  if (intended.zone === "INNER_BULL" || intended.zone === "OUTER_BULL") {
    return nearMissOnStoredBull(intended, hit);
  }

  return nearMissOnStoredRing(intended, hit);
}

/**
 * Classifies a landing against its intended target: `onTarget` (exact pair
 * on a stored zone, or `isAimHit` on a derived one), `nearMiss` (phase-2
 * decision 9's ring/sector adjacency for a stored zone; phase-4 decision 8's
 * neighbouring-number or `INNER_SINGLE`-of-any-number for `NUMBER`/`BULL`),
 * else `loose` — which includes every `MISS`.
 */
export function classifyLanding(
  intended: { number: number; zone: IntentZoneKey },
  hit: { number: number | null; zone: DartZoneKey },
): "onTarget" | "nearMiss" | "loose" {
  if (intended.zone === "NUMBER") return classifyNumberAim(intended, hit);
  if (intended.zone === "BULL") return classifyBullAim(hit);
  return classifyStoredAim(intended, hit);
}

/** Folds `findIntentCells` rows into `loose-darts` buckets: on/near/loose shares per intended target. */
export function looseDartsBuckets(
  rows: readonly IntentCellRow[],
  ctx: { to: string; now: Date },
): SeriesBucket<LooseDartsMetrics>[] {
  const buckets = new Map<
    string,
    { end: string; metrics: LooseDartsMetrics; sampleSize: number }
  >();

  for (const row of rows) {
    const bucket = buckets.get(row.bucketStart) ?? {
      end: row.bucketEnd,
      metrics: {},
      sampleSize: 0,
    };
    bucket.sampleSize += row.darts;

    const key = intendedKey(row);
    const existing = bucket.metrics[key] ?? {
      onTarget: 0,
      nearMiss: 0,
      loose: 0,
    };
    const landing = classifyLanding(
      {
        number: row.intendedTargetNumber,
        zone: row.intendedZoneKey as IntentZoneKey,
      },
      { number: row.hitTargetNumber, zone: row.hitZoneKey as DartZoneKey },
    );
    if (landing === "onTarget") existing.onTarget += row.darts;
    else if (landing === "nearMiss") existing.nearMiss += row.darts;
    else existing.loose += row.darts;
    bucket.metrics[key] = existing;

    buckets.set(row.bucketStart, bucket);
  }

  return Array.from(buckets.keys())
    .sort()
    .map((start) => {
      const bucket = buckets.get(start)!;
      return {
        start,
        end: bucket.end,
        closed: isClosed(bucket.end, ctx.to, ctx.now),
        sampleSize: bucket.sampleSize,
        metrics: bucket.metrics,
      };
    });
}
