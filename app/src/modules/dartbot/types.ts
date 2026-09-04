import type { BoardHit, BoardPoint } from "@lib/types";
import type { DartZoneKey } from "@modules/types";

export type ThrowIntent = {
  targetNumber: number | null;
  zoneKey: DartZoneKey;
};

/**
 * The execution/aim/collision axes a throw is drawn from. `decision`,
 * `pressure`, `form` and `correlation` (08-DartBot.md §SkillProfile axes)
 * are not consumed until later phases and are added to this type when a
 * consumer needs them.
 */
export type SkillProfile = {
  sigmaAlongMm: number;
  sigmaAcrossMm: number;
  covarianceRotationDegrees: number;
  biasXMm: number;
  biasYMm: number;
  outlierRate: number;
  outlierSigmaMm: number;
  bedOffsetMm: number;
  bounceOutRate: number;
  deflectionRadiusMm: number;
  /**
   * `0..100`, D-D's decision axis (`08-DartBot.md` §Decision degrades too) —
   * how well the bot routes a checkout versus always firing at the biggest
   * number. `x01.strategy.module.ts` is the first consumer; every other
   * strategy today dictates its own target and never reads this field.
   */
  decisionQuality: number;
};

export type BotThrow = {
  aim: BoardPoint;
  landing: BoardPoint;
  hit: BoardHit;
  bounced: boolean;
};

/**
 * One pooled scatter across every dart in an extract, not one per level.
 * Produced by `population-prior.module.ts` (D-E, `08-DartBot.md`); not yet
 * consumed anywhere.
 */
export type PopulationPrior = {
  sigmaAlongMm: number;
  sigmaAcrossMm: number;
  biasXMm: number;
  biasYMm: number;
  outlierRate: number;
  sampleSize: number;
  excludedCount: number;
};

/**
 * A level's displayed three-dart-average and checkout-% bands
 * (`level-select-stats.module.ts`, D-L level-select stats). Both bands are
 * the 25th/75th percentile from a per-level simulation — a real spread,
 * not a hand guess. `checkoutLow`/`checkoutHigh` are `0..100`, matching
 * the display string directly.
 */
export type LevelSelectStats = {
  averageLow: number;
  averageHigh: number;
  checkoutLow: number;
  checkoutHigh: number;
};
