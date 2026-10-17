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

type Offset = { dx: number; dy: number };

type ScatterFit = {
  sigmaAlongMm: number;
  sigmaAcrossMm: number;
  biasXMm: number;
  biasYMm: number;
};

const MAX_CLIP_PASSES = 50;

function fitScatter(offsets: readonly Offset[]): ScatterFit {
  const biasXMm = mean(offsets.map((o) => o.dx));
  const biasYMm = mean(offsets.map((o) => o.dy));
  return {
    biasXMm,
    biasYMm,
    sigmaAcrossMm: sampleStdDev(
      offsets.map((o) => o.dx),
      biasXMm,
    ),
    sigmaAlongMm: sampleStdDev(
      offsets.map((o) => o.dy),
      biasYMm,
    ),
  };
}

function withinClip(offset: Offset, fit: ScatterFit): boolean {
  const limit = 3 * Math.hypot(fit.sigmaAlongMm, fit.sigmaAcrossMm);
  return Math.hypot(offset.dx - fit.biasXMm, offset.dy - fit.biasYMm) <= limit;
}

/**
 * Pools every dart into one population-level scatter around each row's own
 * declared-target centroid. `across` is the board's raw x-axis, `along` its
 * raw y-axis, unrotated (matches `throw-engine.module.ts`'s
 * `covarianceRotationDegrees: 0`). A row with no single centre or an unset
 * landing point is excluded, the same rule `missMargin()` applies.
 * Wild darts are clipped iteratively: each pass fits bias and sigma over the
 * kept darts and drops every kept dart farther than
 * `3 * sqrt(sigmaAlong² + sigmaAcross²)` from the bias-shifted centroid,
 * until a pass drops none (at most `MAX_CLIP_PASSES`). Sigma and bias come
 * from the final kept set; `outlierRate` is the clipped share of located
 * darts (D-O, D466, `08-DartBot.md`).
 */
export function foldPopulationPrior(
  rows: readonly MissMarginInput[],
): PopulationPrior {
  const offsets: Offset[] = [];
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

  let kept: readonly Offset[] = offsets;
  let fit = fitScatter(kept);
  for (let pass = 0; pass < MAX_CLIP_PASSES; pass++) {
    const next = kept.filter((o) => withinClip(o, fit));
    if (next.length === kept.length) break;
    kept = next;
    fit = fitScatter(kept);
  }

  return {
    ...fit,
    outlierRate: (offsets.length - kept.length) / offsets.length,
    sampleSize: offsets.length,
    excludedCount,
  };
}
