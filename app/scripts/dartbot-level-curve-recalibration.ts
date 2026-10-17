import { fileURLToPath } from "node:url";
import { LEVEL_SKILL_TABLE } from "../src/modules/dartbot/skill-profile.module";
import type { SkillProfile } from "../src/modules/dartbot/types";
import { interiorPoints } from "./dartbot-bias-flatspot-fix";
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

/** Returns a copy of `table` with only `levels`' `outlierRate` multiplied by `factor`; every other field and level is unchanged. */
export function scaleOutlierRates(
  table: Readonly<Record<number, CurveFields>>,
  factor: number,
  levels: readonly number[],
): Record<number, CurveFields> {
  const result: Record<number, CurveFields> = {};
  for (const [key, fields] of Object.entries(table)) {
    const level = Number(key);
    result[level] = levels.includes(level)
      ? { ...fields, outlierRate: fields.outlierRate * factor }
      : { ...fields };
  }
  return result;
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

/** Level 6 is the v2 extract's pooled, 3σ-clipped fit (`D-E-extract-v2-doubles-trebles.json`, `08-DartBot-Anchor-Log.md`). */
const MID_ANCHOR: CurveFields = {
  sigmaAlongMm: 29.5,
  sigmaAcrossMm: 23.5,
  biasXMm: -1.21,
  biasYMm: -1.57,
  outlierRate: 0.0184,
};

/** Level 15's scaled `biasYMm` (0.4) sits above the interpolated levels 12–14, so their `biasYMm` is re-bracketed geometrically between level 11 and level 15, the `dartbot-bias-flatspot-fix.ts` method. */
const BIAS_Y_REPAIR = { from: 11, to: 15, levels: [12, 13, 14] } as const;

const LEVEL_1_AVG_MIN = 32;
const LEVEL_1_AVG_MAX = 37;
const LEVEL_15_SCALE = 2.0;
const LEVEL_15_AVG_MIN = 99;
const LEVEL_15_AVG_MAX = 103;

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

function main(): void {
  const original = { ...LEVEL_SKILL_TABLE } as Record<number, SkillProfile>;
  const live = LEVEL_SKILL_TABLE as Record<number, SkillProfile>;

  const base = scaleOutlierRates(
    original,
    MID_ANCHOR.outlierRate / original[ANCHOR_MID]!.outlierRate,
    [1, 2, 3, 4, 5],
  );

  const level1Result = searchLevel1(base[1]!, live, original[1]!);
  const level1New = scaleCurve(base[1]!, level1Result.scale);

  const level15New = scaleCurve(original[15]!, LEVEL_15_SCALE);
  live[15] = { ...original[15]!, ...level15New };
  const level15Stats = simulateTierStats(15, SEARCH_SEED, SEARCH_VISITS);
  if (
    level15Stats.threeDartAverage < LEVEL_15_AVG_MIN ||
    level15Stats.threeDartAverage > LEVEL_15_AVG_MAX
  ) {
    throw new Error(
      `level 15 average ${level15Stats.threeDartAverage} outside [${LEVEL_15_AVG_MIN}, ${LEVEL_15_AVG_MAX}] at scale ${LEVEL_15_SCALE}`,
    );
  }

  const table: Record<number, CurveFields> = {
    [ANCHOR_LOW]: level1New,
    [ANCHOR_MID]: MID_ANCHOR,
    [ANCHOR_HIGH]: level15New,
  };
  for (let level = 1; level <= 15; level++) {
    if (level === ANCHOR_LOW || level === ANCHOR_MID || level === ANCHOR_HIGH)
      continue;
    table[level] = interpolateCurve(
      base,
      ANCHOR_LOW,
      level1New,
      ANCHOR_MID,
      MID_ANCHOR,
      ANCHOR_HIGH,
      level15New,
      level,
    );
  }

  const repairedY = interiorPoints(
    table[BIAS_Y_REPAIR.to]!.biasYMm,
    table[BIAS_Y_REPAIR.from]!.biasYMm,
    BIAS_Y_REPAIR.to - BIAS_Y_REPAIR.from,
  );
  BIAS_Y_REPAIR.levels.forEach((level, i) => {
    table[level] = { ...table[level]!, biasYMm: repairedY[i]! };
  });

  console.log(
    JSON.stringify(
      {
        level1: { scale: level1Result.scale, average: level1Result.average },
        level15: {
          scale: LEVEL_15_SCALE,
          checkoutRate: level15Stats.checkoutRate,
          average: level15Stats.threeDartAverage,
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
