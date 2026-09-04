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

const ANCHOR_LEVEL = 6;
const D_E_ANCHOR: CurveFields = {
  sigmaAlongMm: 27.5,
  sigmaAcrossMm: 20.1,
  biasXMm: -5.0,
  biasYMm: 3.1,
  outlierRate: 0.003,
};
const LEVEL_1_TARGET_MIN = 26;
const LEVEL_1_TARGET_MAX = 31;
const SEARCH_SEED = 900000;
const SEARCH_VISITS = 20000;
const SEARCH_ITERATIONS = 40;

export function rescaleLevel(
  currentLevel: CurveFields,
  currentAnchor: CurveFields,
  anchorValues: CurveFields,
  p: number,
): CurveFields {
  const scalar = (
    fieldCurrent: number,
    fieldAnchorCurrent: number,
    fieldAnchorNew: number,
  ) => fieldAnchorNew * (fieldCurrent / fieldAnchorCurrent) ** p;

  const isBiasIdentity =
    currentLevel.biasXMm === currentAnchor.biasXMm &&
    currentLevel.biasYMm === currentAnchor.biasYMm;
  const currentMag = Math.hypot(currentLevel.biasXMm, currentLevel.biasYMm);
  const currentAnchorMag = Math.hypot(
    currentAnchor.biasXMm,
    currentAnchor.biasYMm,
  );
  const anchorMag = Math.hypot(anchorValues.biasXMm, anchorValues.biasYMm);

  let biasXMm: number;
  let biasYMm: number;
  if (currentMag === 0) {
    biasXMm = 0;
    biasYMm = 0;
  } else if (isBiasIdentity) {
    biasXMm = anchorValues.biasXMm;
    biasYMm = anchorValues.biasYMm;
  } else {
    const newMag = anchorMag * (currentMag / currentAnchorMag) ** p;
    biasXMm = (currentLevel.biasXMm / currentMag) * newMag;
    biasYMm = (currentLevel.biasYMm / currentMag) * newMag;
  }

  return {
    sigmaAlongMm: scalar(
      currentLevel.sigmaAlongMm,
      currentAnchor.sigmaAlongMm,
      anchorValues.sigmaAlongMm,
    ),
    sigmaAcrossMm: scalar(
      currentLevel.sigmaAcrossMm,
      currentAnchor.sigmaAcrossMm,
      anchorValues.sigmaAcrossMm,
    ),
    biasXMm,
    biasYMm,
    outlierRate: scalar(
      currentLevel.outlierRate,
      currentAnchor.outlierRate,
      anchorValues.outlierRate,
    ),
  };
}

function main(): void {
  const original = { ...LEVEL_SKILL_TABLE } as Record<number, SkillProfile>;
  const live = LEVEL_SKILL_TABLE as Record<number, SkillProfile>;

  let low = 0.1;
  let high = 6;
  let p = (low + high) / 2;
  let level1Average = 0;

  for (let i = 0; i < SEARCH_ITERATIONS; i++) {
    p = (low + high) / 2;
    const rescaled1 = rescaleLevel(
      original[1]!,
      original[ANCHOR_LEVEL]!,
      D_E_ANCHOR,
      p,
    );
    live[1] = { ...original[1]!, ...rescaled1 };
    level1Average = simulateTierStats(
      1,
      SEARCH_SEED,
      SEARCH_VISITS,
    ).threeDartAverage;
    if (level1Average > LEVEL_1_TARGET_MAX) {
      low = p;
    } else if (level1Average < LEVEL_1_TARGET_MIN) {
      high = p;
    } else {
      break;
    }
  }

  const table: Record<number, CurveFields> = {};
  for (let level = 1; level <= 15; level++) {
    table[level] =
      level === ANCHOR_LEVEL
        ? D_E_ANCHOR
        : rescaleLevel(
            original[level]!,
            original[ANCHOR_LEVEL]!,
            D_E_ANCHOR,
            p,
          );
  }

  console.log(JSON.stringify({ p, level1Average, table }, null, 2));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}
