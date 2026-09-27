import {
  BOARD_RADII_MM,
  SECTOR_ORDER,
  wedgeNearestPoint,
  zoneCentroid,
} from "@lib/game/board/board-geometry.module";
import { formatTargetKey, parseTargetKey } from "@lib/stats/target-key";
import { aimedDarts } from "../derived-aims.module";
import { isClosed } from "./series.module";
import type { IntentZoneKey, SeriesBucket } from "@lib/types";
import type {
  MissDirectionMetrics,
  MissReference,
  MissSectorRow,
  SessionSteps,
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

/** The TS twin of `findMissSectors`' SQL radial-banding `CASE` (phase-2 decision 4, phase-4 decision 7): `INSIDE` below `rInner`, `OUTSIDE` at or beyond `rOuter`, else `WITHIN`. */
export function radialClass(
  r: number,
  rInner: number,
  rOuter: number,
): "INSIDE" | "WITHIN" | "OUTSIDE" {
  if (r < rInner) return "INSIDE";
  if (r >= rOuter) return "OUTSIDE";
  return "WITHIN";
}

const referencesByKey = new Map<string, MissReference>(
  missReferences().map((ref) => [`${ref.zoneKey}:${ref.targetNumber}`, ref]),
);

/**
 * Covers only the missed darts of `aimedDarts` across `sessions` (phase-4
 * decision 7), building each one's `MissSectorRow` the way `findMissSectors`
 * does for a stored zone: `NUMBER:n`'s reference is `wedgeNearestPoint`,
 * banded `[outerBull, doubleOuter]`; `BULL:25`'s reference is the board
 * centre, banded `[0, outerBull]`; every other (stored) aim reuses
 * `missReferences`' own row. The bearing is always `missSector` from the
 * reference point, and the radial band always the dart's own distance from
 * the board centre — mirroring the SQL path exactly, so both share
 * `MissSectorRow`.
 */
export function aimMissRows(
  sessions: readonly SessionSteps<unknown>[],
): MissSectorRow[] {
  const counts = new Map<string, MissSectorRow>();

  for (const session of sessions) {
    for (const dart of aimedDarts(session)) {
      if (dart.hit) continue;

      const aim = parseTargetKey(dart.aim);
      if (aim === null) continue;

      let refX: number;
      let refY: number;
      let rInner: number;
      let rOuter: number;

      if (aim.zone === "NUMBER") {
        const ref = wedgeNearestPoint(aim.number, { x: dart.x, y: dart.y });
        refX = ref.x;
        refY = ref.y;
        rInner = BOARD_RADII_MM.outerBull;
        rOuter = BOARD_RADII_MM.doubleOuter;
      } else if (aim.zone === "BULL") {
        refX = 0;
        refY = 0;
        rInner = 0;
        rOuter = BOARD_RADII_MM.outerBull;
      } else {
        const stored = referencesByKey.get(`${aim.zone}:${aim.number}`);
        if (stored === undefined) continue;
        refX = stored.cx;
        refY = stored.cy;
        rInner = stored.rInner;
        rOuter = stored.rOuter;
      }

      const radius = Math.sqrt(dart.x * dart.x + dart.y * dart.y);
      const radial = radialClass(radius, rInner, rOuter);
      const sector = missSector(dart.x - refX, dart.y - refY);

      const key = `${aim.zone}:${aim.number}|${sector}|${radial}`;
      const existing = counts.get(key);
      if (existing) {
        existing.darts += 1;
        continue;
      }
      counts.set(key, {
        targetNumber: aim.number,
        zoneKey: aim.zone,
        sector,
        radial,
        darts: 1,
      });
    }
  }

  return Array.from(counts.values());
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
