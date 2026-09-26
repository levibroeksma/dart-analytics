import {
  BOARD_RADII_MM,
  SECTOR_ORDER,
  zoneCentroid,
} from "@lib/game/board/board-geometry.module";
import { formatTargetKey } from "@lib/stats/target-key";
import { isClosed } from "./series.module";
import type { IntentZoneKey, SeriesBucket } from "@lib/types";
import type {
  MissDirectionMetrics,
  MissReference,
  MissSectorRow,
} from "@modules/types";

function centroidOf(number: number, zoneKey: IntentZoneKey) {
  const centroid = zoneCentroid(number, zoneKey);
  if (centroid === null) {
    throw new Error(`no centroid for ${zoneKey}:${number}`);
  }
  return centroid;
}

const NUMBERED_RING_RADII: Record<
  Exclude<IntentZoneKey, "INNER_BULL" | "OUTER_BULL">,
  { rInner: number; rOuter: number }
> = {
  DOUBLE: {
    rInner: BOARD_RADII_MM.doubleInner,
    rOuter: BOARD_RADII_MM.doubleOuter,
  },
  TREBLE: {
    rInner: BOARD_RADII_MM.trebleInner,
    rOuter: BOARD_RADII_MM.trebleOuter,
  },
  INNER_SINGLE: {
    rInner: BOARD_RADII_MM.outerBull,
    rOuter: BOARD_RADII_MM.trebleInner,
  },
  OUTER_SINGLE: {
    rInner: BOARD_RADII_MM.trebleOuter,
    rOuter: BOARD_RADII_MM.doubleInner,
  },
};

/**
 * Every reference point `findMissSectors` binds as its `VALUES` join
 * (phase-2 decision 4): the 20 numbered rings' four bands, plus both bulls —
 * 82 rows in total.
 */
export function missReferences(): MissReference[] {
  const refs: MissReference[] = [];

  for (const number of SECTOR_ORDER) {
    for (const zoneKey of Object.keys(
      NUMBERED_RING_RADII,
    ) as (keyof typeof NUMBERED_RING_RADII)[]) {
      const centroid = centroidOf(number, zoneKey);
      const { rInner, rOuter } = NUMBERED_RING_RADII[zoneKey];
      refs.push({
        targetNumber: number,
        zoneKey,
        cx: centroid.x,
        cy: centroid.y,
        rInner,
        rOuter,
      });
    }
  }

  const bullCentroid = centroidOf(25, "INNER_BULL");
  refs.push({
    targetNumber: 25,
    zoneKey: "INNER_BULL",
    cx: bullCentroid.x,
    cy: bullCentroid.y,
    rInner: 0,
    rOuter: BOARD_RADII_MM.innerBull,
  });
  refs.push({
    targetNumber: 25,
    zoneKey: "OUTER_BULL",
    cx: bullCentroid.x,
    cy: bullCentroid.y,
    rInner: BOARD_RADII_MM.innerBull,
    rOuter: BOARD_RADII_MM.outerBull,
  });

  return refs;
}

/** The TS twin of `findMissSectors`' SQL sector expression (phase-2 decision 4) — used by tests and the UI legend. */
export function missSector(dx: number, dy: number): number {
  const bearing = (Math.atan2(dx, -dy) * (180 / Math.PI) + 360) % 360;
  return Math.floor(((bearing + 22.5) % 360) / 45) % 8;
}

/** Folds `findMissSectors` rows (not bucketable) into a single sector/radial-rose bucket per intended target. */
export function missDirectionBuckets(
  rows: readonly MissSectorRow[],
  ctx: { from: string; to: string; now: Date },
): SeriesBucket<MissDirectionMetrics>[] {
  if (rows.length === 0) return [];

  const metrics: MissDirectionMetrics = {};
  let sampleSize = 0;

  for (const row of rows) {
    sampleSize += row.darts;
    const key = formatTargetKey(row.targetNumber, row.zoneKey as IntentZoneKey);
    const entries = metrics[key] ?? [];
    entries.push({ sector: row.sector, radial: row.radial, darts: row.darts });
    metrics[key] = entries;
  }

  return [
    {
      start: ctx.from,
      end: ctx.to,
      closed: isClosed(ctx.to, ctx.to, ctx.now),
      sampleSize,
      metrics,
    },
  ];
}
