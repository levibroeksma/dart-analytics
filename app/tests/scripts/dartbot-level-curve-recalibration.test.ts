import { describe, expect, it } from "vitest";
import {
  interpolateCurve,
  scaleCurve,
} from "../../scripts/dartbot-level-curve-recalibration";

describe("scaleCurve", () => {
  it("scales every field uniformly", () => {
    const base = {
      sigmaAlongMm: 10,
      sigmaAcrossMm: 8,
      biasXMm: 3,
      biasYMm: 4,
      outlierRate: 0.02,
    };
    const result = scaleCurve(base, 2);
    expect(result).toEqual({
      sigmaAlongMm: 20,
      sigmaAcrossMm: 16,
      biasXMm: 6,
      biasYMm: 8,
      outlierRate: 0.04,
    });
  });

  it("preserves bias direction (scaling x and y by the same factor never rotates)", () => {
    const base = {
      sigmaAlongMm: 10,
      sigmaAcrossMm: 8,
      biasXMm: 3,
      biasYMm: -4,
      outlierRate: 0.02,
    };
    const result = scaleCurve(base, 0.5);
    expect(Math.atan2(result.biasYMm, result.biasXMm)).toBeCloseTo(
      Math.atan2(base.biasYMm, base.biasXMm),
      10,
    );
  });
});

describe("interpolateCurve", () => {
  const currentTable: Record<
    number,
    {
      sigmaAlongMm: number;
      sigmaAcrossMm: number;
      biasXMm: number;
      biasYMm: number;
      outlierRate: number;
    }
  > = {
    1: {
      sigmaAlongMm: 80,
      sigmaAcrossMm: 60,
      biasXMm: 10,
      biasYMm: 10,
      outlierRate: 0.02,
    },
    3: {
      sigmaAlongMm: 40,
      sigmaAcrossMm: 30,
      biasXMm: 5,
      biasYMm: 5,
      outlierRate: 0.01,
    },
    6: {
      sigmaAlongMm: 20,
      sigmaAcrossMm: 15,
      biasXMm: 2,
      biasYMm: 2,
      outlierRate: 0.005,
    },
    10: {
      sigmaAlongMm: 8,
      sigmaAcrossMm: 6,
      biasXMm: 1,
      biasYMm: 1,
      outlierRate: 0.002,
    },
    15: {
      sigmaAlongMm: 2,
      sigmaAcrossMm: 1.5,
      biasXMm: 0.2,
      biasYMm: 0.2,
      outlierRate: 0.0005,
    },
  };
  const lowValue = {
    sigmaAlongMm: 40,
    sigmaAcrossMm: 40,
    biasXMm: 6,
    biasYMm: 8,
    outlierRate: 0.04,
  };
  const midValue = {
    sigmaAlongMm: 27.5,
    sigmaAcrossMm: 20.1,
    biasXMm: -5.0,
    biasYMm: 3.1,
    outlierRate: 0.003,
  };
  const highValue = {
    sigmaAlongMm: 4,
    sigmaAcrossMm: 3,
    biasXMm: 0.4,
    biasYMm: 0.4,
    outlierRate: 0.001,
  };

  it("returns the exact anchor value at the low, mid and high levels, for either segment", () => {
    expect(
      interpolateCurve(
        currentTable,
        1,
        lowValue,
        6,
        midValue,
        15,
        highValue,
        1,
      ),
    ).toEqual(lowValue);
    expect(
      interpolateCurve(
        currentTable,
        1,
        lowValue,
        6,
        midValue,
        15,
        highValue,
        6,
      ),
    ).toEqual(midValue);
    expect(
      interpolateCurve(
        currentTable,
        1,
        lowValue,
        6,
        midValue,
        15,
        highValue,
        15,
      ),
    ).toEqual(highValue);
  });

  it("interpolates a level in the low segment strictly between the low and mid anchors", () => {
    const result = interpolateCurve(
      currentTable,
      1,
      lowValue,
      6,
      midValue,
      15,
      highValue,
      3,
    );
    expect(result.sigmaAlongMm).toBeGreaterThan(midValue.sigmaAlongMm);
    expect(result.sigmaAlongMm).toBeLessThan(lowValue.sigmaAlongMm);
    expect(result.outlierRate).toBeGreaterThan(midValue.outlierRate);
    expect(result.outlierRate).toBeLessThan(lowValue.outlierRate);
  });

  it("interpolates a level in the high segment strictly between the mid and high anchors", () => {
    const result = interpolateCurve(
      currentTable,
      1,
      lowValue,
      6,
      midValue,
      15,
      highValue,
      10,
    );
    expect(result.sigmaAlongMm).toBeLessThan(midValue.sigmaAlongMm);
    expect(result.sigmaAlongMm).toBeGreaterThan(highValue.sigmaAlongMm);
  });

  it("preserves each level's own current bias direction rather than an anchor's", () => {
    const skewedTable = {
      ...currentTable,
      3: { ...currentTable[3]!, biasXMm: -5, biasYMm: 5 },
    };
    const result = interpolateCurve(
      skewedTable,
      1,
      lowValue,
      6,
      midValue,
      15,
      highValue,
      3,
    );
    expect(Math.atan2(result.biasYMm, result.biasXMm)).toBeCloseTo(
      Math.atan2(5, -5),
      10,
    );
  });

  it("throws for a level outside the anchor range", () => {
    expect(() =>
      interpolateCurve(
        currentTable,
        1,
        lowValue,
        6,
        midValue,
        15,
        highValue,
        0,
      ),
    ).toThrow();
    expect(() =>
      interpolateCurve(
        currentTable,
        1,
        lowValue,
        6,
        midValue,
        15,
        highValue,
        16,
      ),
    ).toThrow();
  });
});
