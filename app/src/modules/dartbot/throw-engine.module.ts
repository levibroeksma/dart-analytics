import { classify } from "@lib/game/board/board-geometry.module";
import type { BoardPoint } from "@lib/types";
import { resolveAimPoint } from "./aim-resolver.module";
import type { DartRng } from "./interfaces";
import type { BotThrow, SkillProfile, ThrowIntent } from "./types";

function rotate(point: BoardPoint, degrees: number): BoardPoint {
  const radians = (degrees * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  return {
    x: point.x * cos - point.y * sin,
    y: point.x * sin + point.y * cos,
  };
}

function scatterOffset(profile: SkillProfile, rng: DartRng): BoardPoint {
  const isOutlier = rng.uniform() < profile.outlierRate;
  const [zAlong, zAcross] = rng.gaussianPair();
  const sigmaAlong = isOutlier ? profile.outlierSigmaMm : profile.sigmaAlongMm;
  const sigmaAcross = isOutlier
    ? profile.outlierSigmaMm
    : profile.sigmaAcrossMm;
  const local = { x: zAcross * sigmaAcross, y: zAlong * sigmaAlong };
  return rotate(local, profile.covarianceRotationDegrees);
}

function applyBounce(
  landing: BoardPoint,
  profile: SkillProfile,
  rng: DartRng,
): { landing: BoardPoint; bounced: boolean } {
  if (rng.uniform() >= profile.bounceOutRate) {
    return { landing, bounced: false };
  }
  const radius = Math.hypot(landing.x, landing.y);
  if (radius === 0) {
    return { landing: { x: profile.deflectionRadiusMm, y: 0 }, bounced: true };
  }
  const scale = (radius + profile.deflectionRadiusMm) / radius;
  return {
    landing: { x: landing.x * scale, y: landing.y * scale },
    bounced: true,
  };
}

export function throwDart(
  intent: ThrowIntent,
  profile: SkillProfile,
  rng: DartRng,
): BotThrow {
  const aim = resolveAimPoint(intent, profile);
  const offset = scatterOffset(profile, rng);
  const preBounce = {
    x: aim.x + profile.biasXMm + offset.x,
    y: aim.y + profile.biasYMm + offset.y,
  };
  const { landing, bounced } = applyBounce(preBounce, profile, rng);
  const hit = classify(landing.x, landing.y);
  return { aim, landing, hit, bounced };
}
