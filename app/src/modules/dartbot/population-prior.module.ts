import { zoneCentroid } from "@lib/game/board/board-geometry.module";
import type { MissMarginInput } from "@lib/types";
import type { PopulationPrior } from "./types";

function mean(values: readonly number[]): number {
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function sampleStdDev(values: readonly number[], center: number): number {
  if (values.length < 2) return 0;
  const variance =
    values.reduce((sum, v) => sum + (v - center) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

/**
 * D-E's fold (`08-DartBot.md` §Still open): pools every row into one
 * population-level scatter around each row's own declared-target centroid —
 * `across` is the board's raw x-axis and `along` its raw y-axis, matching
 * `throw-engine.module.ts`'s unrotated local frame (`covarianceRotationDegrees`
 * is 0 for every hand-set level today, so bias and scatter apply in board
 * coordinates directly rather than per-target-rotated ones). A row is
 * excluded when `zoneCentroid()` has no single centre to measure from (bare
 * `SINGLE`, `MISS`) or its landing point is unset — the same exclusions
 * `missMargin()` applies, reused here rather than reimplemented.
 *
 * `outlierRate` is the fraction landing beyond 3 population-radial-sigma
 * (`sqrt(sigmaAlong² + sigmaAcross²)`) from its own centroid — the closest
 * single-number reading of the doc's "tail beyond 3σ" for a scatter with two
 * different axis widths.
 */
export function foldPopulationPrior(
  rows: readonly MissMarginInput[],
): PopulationPrior {
  const offsets: { dx: number; dy: number }[] = [];
  let excludedCount = 0;

  for (const row of rows) {
    if (
      row.intendedZoneKey === null ||
      row.locationX === null ||
      row.locationY === null
    ) {
      excludedCount++;
      continue;
    }
    const centre = zoneCentroid(row.intendedTargetNumber, row.intendedZoneKey);
    if (centre === null) {
      excludedCount++;
      continue;
    }
    offsets.push({
      dx: row.locationX - centre.x,
      dy: row.locationY - centre.y,
    });
  }

  if (offsets.length === 0) {
    return {
      sigmaAlongMm: 0,
      sigmaAcrossMm: 0,
      biasXMm: 0,
      biasYMm: 0,
      outlierRate: 0,
      sampleSize: 0,
      excludedCount,
    };
  }

  const biasXMm = mean(offsets.map((o) => o.dx));
  const biasYMm = mean(offsets.map((o) => o.dy));
  const sigmaAcrossMm = sampleStdDev(
    offsets.map((o) => o.dx),
    biasXMm,
  );
  const sigmaAlongMm = sampleStdDev(
    offsets.map((o) => o.dy),
    biasYMm,
  );
  const sigmaRadialMm = Math.sqrt(sigmaAlongMm ** 2 + sigmaAcrossMm ** 2);

  const outlierCount = offsets.filter(
    (o) => Math.sqrt(o.dx ** 2 + o.dy ** 2) > 3 * sigmaRadialMm,
  ).length;

  return {
    sigmaAlongMm,
    sigmaAcrossMm,
    biasXMm,
    biasYMm,
    outlierRate: outlierCount / offsets.length,
    sampleSize: offsets.length,
    excludedCount,
  };
}
