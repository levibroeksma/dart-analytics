import { describe, expect, it } from "vitest";
import { zoneCentroid } from "@lib/game/board/board-geometry.module";
import { resolveAimPoint } from "@modules/dartbot/aim-resolver.module";
import type { SkillProfile } from "@modules/types";

const ZERO_OFFSET_PROFILE: SkillProfile = {
  sigmaAlongMm: 10,
  sigmaAcrossMm: 10,
  covarianceRotationDegrees: 0,
  biasXMm: 0,
  biasYMm: 0,
  outlierRate: 0,
  outlierSigmaMm: 0,
  bedOffsetMm: 0,
  bounceOutRate: 0,
  deflectionRadiusMm: 0,
  decisionQuality: 100,
};

describe("resolveAimPoint", () => {
  it("aims at the shared geometry's centroid when bedOffset is zero", () => {
    const centroid = zoneCentroid(20, "TREBLE");
    const aim = resolveAimPoint(
      { targetNumber: 20, zoneKey: "TREBLE" },
      ZERO_OFFSET_PROFILE,
    );
    expect(aim).toEqual(centroid);
  });

  it("pushes the aim point radially outward by bedOffsetMm", () => {
    const centroid = zoneCentroid(20, "DOUBLE")!;
    const profile: SkillProfile = { ...ZERO_OFFSET_PROFILE, bedOffsetMm: 5 };
    const aim = resolveAimPoint(
      { targetNumber: 20, zoneKey: "DOUBLE" },
      profile,
    );
    const centroidRadius = Math.hypot(centroid.x, centroid.y);
    const aimRadius = Math.hypot(aim.x, aim.y);
    expect(aimRadius).toBeCloseTo(centroidRadius + 5, 6);
  });

  it("falls back to the bull when the intent has no centroid", () => {
    const aim = resolveAimPoint(
      { targetNumber: null, zoneKey: "MISS" },
      ZERO_OFFSET_PROFILE,
    );
    expect(aim).toEqual({ x: 0, y: 0 });
  });
});
