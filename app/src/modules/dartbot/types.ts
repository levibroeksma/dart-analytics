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
};
