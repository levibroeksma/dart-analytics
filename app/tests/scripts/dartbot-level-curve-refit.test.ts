import { describe, expect, it } from "vitest";
import { rescaleLevel } from "../../scripts/dartbot-level-curve-refit";

const anchor = {
  sigmaAlongMm: 20,
  sigmaAcrossMm: 20,
  biasXMm: 3,
  biasYMm: 4,
  outlierRate: 0.05,
};
const weak = {
  sigmaAlongMm: 40,
  sigmaAcrossMm: 40,
  biasXMm: 6,
  biasYMm: 8,
  outlierRate: 0.1,
};
const measured = {
  sigmaAlongMm: 10,
  sigmaAcrossMm: 10,
  biasXMm: -1,
  biasYMm: 2,
  outlierRate: 0.01,
};

describe("rescaleLevel", () => {
  it("returns the anchor values exactly when the level is its own anchor, for any p", () => {
    expect(rescaleLevel(anchor, anchor, measured, 1)).toEqual(measured);
    expect(rescaleLevel(anchor, anchor, measured, 3.7)).toEqual(measured);
  });

  it("rescales sigma and outlier proportionally at p = 1", () => {
    const result = rescaleLevel(weak, anchor, measured, 1);
    // ratio = weak/anchor = 2 for every scalar field here
    expect(result.sigmaAlongMm).toBeCloseTo(20, 5);
    expect(result.sigmaAcrossMm).toBeCloseTo(20, 5);
    expect(result.outlierRate).toBeCloseTo(0.02, 5);
    // bias magnitude: anchorMag(measured) = sqrt(1+4) ≈ 2.2360679..., × ratio 2
    // direction: weak's own unit vector (0.6, 0.8)
    expect(result.biasXMm).toBeCloseTo(2.68328157, 5);
    expect(result.biasYMm).toBeCloseTo(3.57770876, 5);
  });

  it("widens the gap beyond proportional when p > 1", () => {
    const result = rescaleLevel(weak, anchor, measured, 2);
    // ratio^2 = 4
    expect(result.sigmaAlongMm).toBeCloseTo(40, 5);
    expect(result.outlierRate).toBeCloseTo(0.04, 5);
    expect(result.biasXMm).toBeCloseTo(5.36656315, 5);
    expect(result.biasYMm).toBeCloseTo(7.15541753, 5);
  });

  it("keeps zero bias magnitude at zero regardless of p", () => {
    const zeroBias = { ...weak, biasXMm: 0, biasYMm: 0 };
    const result = rescaleLevel(zeroBias, anchor, measured, 2);
    expect(result.biasXMm).toBe(0);
    expect(result.biasYMm).toBe(0);
  });
});
