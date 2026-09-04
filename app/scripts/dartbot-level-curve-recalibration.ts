import { fileURLToPath } from "node:url";
import { LEVEL_SKILL_TABLE } from "../src/modules/dartbot/skill-profile.module";
import type { SkillProfile } from "../src/modules/dartbot/types";
import { simulateTierStats } from "../tests/modules/dartbot/harness/simulate-tier";

export type CurveFields = {
  sigmaAlongMm: number;
  sigmaAcrossMm: number;
  biasXMm: number;
  biasYMm: number;
  outlierRate: number;
};

/** Uniformly scales every field of a curve by `scale`. Bias direction is unaffected — scaling x and y by the same factor never rotates the vector. */
export function scaleCurve(base: CurveFields, scale: number): CurveFields {
  return {
    sigmaAlongMm: base.sigmaAlongMm * scale,
    sigmaAcrossMm: base.sigmaAcrossMm * scale,
    biasXMm: base.biasXMm * scale,
    biasYMm: base.biasYMm * scale,
    outlierRate: base.outlierRate * scale,
  };
}

/**
 * Piecewise log-space interpolation across two segments (`lowLevel`→`midLevel`,
 * `midLevel`→`highLevel`), positioning each intermediate level by where its
 * *pre-edit* value for that field sits, in log space, between the segment's
 * two pre-edit endpoints — so the new curve keeps the old curve's relative
 * shape while landing on new anchor values. A level outside `[lowLevel,
 * highLevel]` throws; the three anchor levels return their exact new value.
 */
export function interpolateCurve(
  currentTable: Readonly<Record<number, CurveFields>>,
  lowLevel: number,
  lowValue: CurveFields,
  midLevel: number,
  midValue: CurveFields,
  highLevel: number,
  highValue: CurveFields,
  level: number,
): CurveFields {
  if (level < lowLevel || level > highLevel) {
    throw new Error(
      `level ${level} outside interpolation range [${lowLevel}, ${highLevel}]`,
    );
  }
  if (level === lowLevel) return lowValue;
  if (level === midLevel) return midValue;
  if (level === highLevel) return highValue;

  const [segStart, segStartNew, segEnd, segEndNew] =
    level < midLevel
      ? [lowLevel, lowValue, midLevel, midValue]
      : [midLevel, midValue, highLevel, highValue];

  const current = currentTable[level]!;
  const currentStart = currentTable[segStart]!;
  const currentEnd = currentTable[segEnd]!;

  const interpField = (field: keyof CurveFields): number => {
    const logStart = Math.log(currentStart[field]);
    const logEnd = Math.log(currentEnd[field]);
    const logCurrent = Math.log(current[field]);
    const t = (logCurrent - logStart) / (logEnd - logStart);
    const logNewStart = Math.log(segStartNew[field]);
    const logNewEnd = Math.log(segEndNew[field]);
    return Math.exp(logNewStart + t * (logNewEnd - logNewStart));
  };

  const biasMagCurrent = Math.hypot(current.biasXMm, current.biasYMm);
  const unitX = biasMagCurrent === 0 ? 0 : current.biasXMm / biasMagCurrent;
  const unitY = biasMagCurrent === 0 ? 0 : current.biasYMm / biasMagCurrent;
  const biasMagStart = Math.hypot(currentStart.biasXMm, currentStart.biasYMm);
  const biasMagEnd = Math.hypot(currentEnd.biasXMm, currentEnd.biasYMm);
  const biasMagStartNew = Math.hypot(segStartNew.biasXMm, segStartNew.biasYMm);
  const biasMagEndNew = Math.hypot(segEndNew.biasXMm, segEndNew.biasYMm);
  const tBias =
    biasMagEnd === biasMagStart
      ? 0
      : (biasMagCurrent - biasMagStart) / (biasMagEnd - biasMagStart);
  const newBiasMag =
    biasMagStartNew + tBias * (biasMagEndNew - biasMagStartNew);

  return {
    sigmaAlongMm: interpField("sigmaAlongMm"),
    sigmaAcrossMm: interpField("sigmaAcrossMm"),
    outlierRate: interpField("outlierRate"),
    biasXMm: unitX * newBiasMag,
    biasYMm: unitY * newBiasMag,
  };
}

const ANCHOR_LOW = 1;
const ANCHOR_MID = 6;
const ANCHOR_HIGH = 15;

/** Level 6 stays exactly the D-E measured population prior (`08-DartBot-Anchor-Log.md`) — unchanged by this recalibration. */
const MID_ANCHOR: CurveFields = {
  sigmaAlongMm: 27.5,
  sigmaAcrossMm: 20.1,
  biasXMm: -5.0,
  biasYMm: 3.1,
  outlierRate: 0.003,
};

const LEVEL_1_AVG_MIN = 32;
const LEVEL_1_AVG_MAX = 37;
const LEVEL_15_CHECKOUT_MIN = 0.45;
const LEVEL_15_CHECKOUT_MAX = 0.8;
const LEVEL_15_AVG_MIN = 90;

const SEARCH_SEED = 900001;
const SEARCH_VISITS = 20000;
const SEARCH_ITERATIONS = 40;

/** Binary-searches a uniform scale on `base` so level 1's simulated three-dart average lands in [`LEVEL_1_AVG_MIN`, `LEVEL_1_AVG_MAX`]. Larger scale means more spread, which lowers the average. */
function searchLevel1(
  base: CurveFields,
  live: Record<number, SkillProfile>,
  original1: SkillProfile,
): { scale: number; average: number } {
  let low = 0.1;
  let high = 3;
  let scale = (low + high) / 2;
  let average = 0;
  for (let i = 0; i < SEARCH_ITERATIONS; i++) {
    scale = (low + high) / 2;
    live[1] = { ...original1, ...scaleCurve(base, scale) };
    average = simulateTierStats(1, SEARCH_SEED, SEARCH_VISITS).threeDartAverage;
    if (average > LEVEL_1_AVG_MAX) {
      low = scale;
    } else if (average < LEVEL_1_AVG_MIN) {
      high = scale;
    } else {
      break;
    }
  }
  return { scale, average };
}

/** Binary-searches a uniform scale on `base` so level 15's simulated checkout rate lands in [`LEVEL_15_CHECKOUT_MIN`, `LEVEL_15_CHECKOUT_MAX`]. Larger scale means more spread, which lowers checkout rate. */
function searchLevel15(
  base: CurveFields,
  live: Record<number, SkillProfile>,
  original15: SkillProfile,
): { scale: number; checkoutRate: number; average: number } {
  let low = 0.5;
  let high = 15;
  let scale = (low + high) / 2;
  let stats = { threeDartAverage: 0, checkoutRate: 0 };
  for (let i = 0; i < SEARCH_ITERATIONS; i++) {
    scale = (low + high) / 2;
    live[15] = { ...original15, ...scaleCurve(base, scale) };
    stats = simulateTierStats(15, SEARCH_SEED, SEARCH_VISITS);
    if (stats.checkoutRate > LEVEL_15_CHECKOUT_MAX) {
      low = scale;
    } else if (stats.checkoutRate < LEVEL_15_CHECKOUT_MIN) {
      high = scale;
    } else {
      break;
    }
  }
  return {
    scale,
    checkoutRate: stats.checkoutRate,
    average: stats.threeDartAverage,
  };
}

function main(): void {
  const original = { ...LEVEL_SKILL_TABLE } as Record<number, SkillProfile>;
  const live = LEVEL_SKILL_TABLE as Record<number, SkillProfile>;

  const level1Result = searchLevel1(original[1]!, live, original[1]!);
  const level15Result = searchLevel15(original[15]!, live, original[15]!);

  if (level15Result.average < LEVEL_15_AVG_MIN) {
    throw new Error(
      `level 15 average ${level15Result.average} fell below the ${LEVEL_15_AVG_MIN} floor at the checkout-matched scale`,
    );
  }

  const level1New = scaleCurve(original[1]!, level1Result.scale);
  const level15New = scaleCurve(original[15]!, level15Result.scale);

  const table: Record<number, CurveFields> = {
    [ANCHOR_LOW]: level1New,
    [ANCHOR_MID]: MID_ANCHOR,
    [ANCHOR_HIGH]: level15New,
  };
  for (let level = 1; level <= 15; level++) {
    if (level === ANCHOR_LOW || level === ANCHOR_MID || level === ANCHOR_HIGH)
      continue;
    table[level] = interpolateCurve(
      original,
      ANCHOR_LOW,
      level1New,
      ANCHOR_MID,
      MID_ANCHOR,
      ANCHOR_HIGH,
      level15New,
      level,
    );
  }

  console.log(
    JSON.stringify(
      {
        level1: { scale: level1Result.scale, average: level1Result.average },
        level15: {
          scale: level15Result.scale,
          checkoutRate: level15Result.checkoutRate,
          average: level15Result.average,
        },
        table,
      },
      null,
      2,
    ),
  );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}
