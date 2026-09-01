import { describe, expect, it, vi } from "vitest";
import { classify } from "@lib/game/board/board-geometry.module";
import { throwDart } from "@modules/dartbot/throw-engine.module";
import type { DartRng } from "@modules/interfaces";
import type { SkillProfile, ThrowIntent } from "@modules/types";

function stubRng(
  uniforms: number[],
  gaussianPairs: [number, number][],
): DartRng {
  let uIndex = 0;
  let gIndex = 0;
  return {
    uniform: () => uniforms[uIndex++]!,
    gaussianPair: () => gaussianPairs[gIndex++]!,
  };
}

const BASE_PROFILE: SkillProfile = {
  sigmaAlongMm: 5,
  sigmaAcrossMm: 5,
  covarianceRotationDegrees: 0,
  biasXMm: 0,
  biasYMm: 0,
  outlierRate: 0.1,
  outlierSigmaMm: 100,
  bedOffsetMm: 0,
  bounceOutRate: 0.1,
  deflectionRadiusMm: 20,
};

const T20_TREBLE: ThrowIntent = { targetNumber: 20, zoneKey: "TREBLE" };

describe("throwDart", () => {
  it("uses the wide outlier sigma when the outlier draw succeeds", () => {
    const rng = stubRng([0.01, 0.9], [[3, 0]]);
    const thrown = throwDart(T20_TREBLE, BASE_PROFILE, rng);
    const distanceFromAim = Math.hypot(
      thrown.landing.x - thrown.aim.x,
      thrown.landing.y - thrown.aim.y,
    );
    expect(distanceFromAim).toBeCloseTo(300, 6);
  });

  it("uses the normal sigma when the outlier draw fails", () => {
    const rng = stubRng([0.99, 0.9], [[3, 0]]);
    const thrown = throwDart(T20_TREBLE, BASE_PROFILE, rng);
    const distanceFromAim = Math.hypot(
      thrown.landing.x - thrown.aim.x,
      thrown.landing.y - thrown.aim.y,
    );
    expect(distanceFromAim).toBeCloseTo(15, 6);
  });

  it("bounces the landing point outward when the bounce draw succeeds", () => {
    const rng = stubRng([0.99, 0.01], [[0, 0]]);
    const thrown = throwDart(T20_TREBLE, BASE_PROFILE, rng);
    expect(thrown.bounced).toBe(true);
    const radiusBeforeBounce = Math.hypot(thrown.aim.x, thrown.aim.y);
    const radiusAfterBounce = Math.hypot(thrown.landing.x, thrown.landing.y);
    expect(radiusAfterBounce).toBeCloseTo(radiusBeforeBounce + 20, 6);
  });

  it("does not bounce when the bounce draw fails", () => {
    const rng = stubRng([0.99, 0.99], [[0, 0]]);
    const thrown = throwDart(T20_TREBLE, BASE_PROFILE, rng);
    expect(thrown.bounced).toBe(false);
  });

  it("classifies the landing point through the shared geometry module", () => {
    const rng = stubRng([0.99, 0.99], [[0, 0]]);
    const thrown = throwDart(T20_TREBLE, BASE_PROFILE, rng);
    expect(thrown.hit).toEqual(classify(thrown.landing.x, thrown.landing.y));
  });

  it("never calls Math.random", () => {
    const spy = vi.spyOn(Math, "random");
    const rng = stubRng([0.99, 0.99], [[0, 0]]);
    throwDart(T20_TREBLE, BASE_PROFILE, rng);
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});
