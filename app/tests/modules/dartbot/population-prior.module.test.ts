import { describe, expect, it } from "vitest";
import { foldPopulationPrior } from "@modules/dartbot/population-prior.module";
import type { MissMarginInput } from "@lib/types";

function darts(offsets: { dx: number; dy: number }[]): MissMarginInput[] {
  // 20's DOUBLE centroid sits on the board's upward vertical (x=0), at
  // radius (doubleInner + doubleOuter) / 2 = 166mm, above the bull.
  const centre = { x: 0, y: -166 };
  return offsets.map(({ dx, dy }) => ({
    intendedTargetNumber: 20,
    intendedZoneKey: "DOUBLE",
    locationX: centre.x + dx,
    locationY: centre.y + dy,
  }));
}

describe("foldPopulationPrior", () => {
  it("reads bias as the mean offset from each row's own centroid", () => {
    const prior = foldPopulationPrior(
      darts([
        { dx: 4, dy: 2 },
        { dx: 6, dy: 2 },
      ]),
    );
    expect(prior.biasXMm).toBeCloseTo(5);
    expect(prior.biasYMm).toBeCloseTo(2);
  });

  it("reads sigma as the sample stddev around the mean, per axis", () => {
    const prior = foldPopulationPrior(
      darts([
        { dx: -10, dy: 0 },
        { dx: 10, dy: 0 },
        { dx: 0, dy: -5 },
        { dx: 0, dy: 5 },
      ]),
    );
    expect(prior.sigmaAcrossMm).toBeCloseTo(Math.sqrt(200 / 3));
    expect(prior.sigmaAlongMm).toBeCloseTo(Math.sqrt(50 / 3));
  });

  it("counts a row beyond 3-radial-sigma as an outlier", () => {
    const tight = Array.from({ length: 20 }, () => ({ dx: 1, dy: -1 }));
    const outlier = { dx: 500, dy: 500 };
    const prior = foldPopulationPrior(darts([...tight, outlier]));
    expect(prior.outlierRate).toBeCloseTo(1 / 21);
  });

  it("excludes clipped wild darts from sigma and bias", () => {
    const tight = Array.from({ length: 20 }, (_, i) => ({
      dx: i % 2 === 0 ? -2 : 2,
      dy: 0,
    }));
    const prior = foldPopulationPrior(darts([...tight, { dx: 300, dy: 300 }]));
    expect(prior.outlierRate).toBeCloseTo(1 / 21);
    expect(prior.biasXMm).toBeCloseTo(0);
    expect(prior.biasYMm).toBeCloseTo(0);
    expect(prior.sigmaAcrossMm).toBeCloseTo(Math.sqrt(80 / 19), 5);
    expect(prior.sigmaAlongMm).toBeCloseTo(0);
    expect(prior.sampleSize).toBe(21);
  });

  it("keeps a zero-spread cluster and still clips the far dart", () => {
    const tight = Array.from({ length: 20 }, () => ({ dx: 1, dy: -1 }));
    const prior = foldPopulationPrior(darts([...tight, { dx: 500, dy: 500 }]));
    expect(prior.outlierRate).toBeCloseTo(1 / 21);
    expect(prior.biasXMm).toBeCloseTo(1);
    expect(prior.sigmaAcrossMm).toBe(0);
  });

  it("re-clips until the kept set is stable", () => {
    const tight = Array.from({ length: 40 }, (_, i) => ({
      dx: i % 2 === 0 ? -1 : 1,
      dy: 0,
    }));
    const prior = foldPopulationPrior(
      darts([
        ...tight,
        { dx: 30, dy: 0 },
        { dx: 30, dy: 0 },
        { dx: 400, dy: 0 },
      ]),
    );
    expect(prior.outlierRate).toBeCloseTo(3 / 43);
  });

  it("returns zero sigma when the clip keeps fewer than two darts", () => {
    const prior = foldPopulationPrior(darts([{ dx: 3, dy: 4 }]));
    expect(prior.sigmaAlongMm).toBe(0);
    expect(prior.sigmaAcrossMm).toBe(0);
    for (const value of Object.values(prior)) {
      expect(Number.isNaN(value)).toBe(false);
    }
  });

  it("stops after a bounded number of passes", () => {
    const tail = Array.from({ length: 12 }, (_, i) => ({ dx: 2 ** i, dy: 0 }));
    const tight = Array.from({ length: 40 }, (_, i) => ({
      dx: i % 2 === 0 ? -1 : 1,
      dy: 0,
    }));
    const prior = foldPopulationPrior(darts([...tight, ...tail]));
    expect(prior.sampleSize).toBe(52);
    expect(prior.outlierRate).toBeGreaterThan(0);
    expect(prior.outlierRate).toBeLessThan(1);
  });

  it("excludes a row with no single centroid or an unset landing point", () => {
    const rows: MissMarginInput[] = [
      {
        intendedTargetNumber: 20,
        intendedZoneKey: "SINGLE",
        locationX: 0,
        locationY: -100,
      },
      {
        intendedTargetNumber: 20,
        intendedZoneKey: "DOUBLE",
        locationX: null,
        locationY: null,
      },
      ...darts([{ dx: 1, dy: 1 }]),
    ];
    const prior = foldPopulationPrior(rows);
    expect(prior.sampleSize).toBe(1);
    expect(prior.excludedCount).toBe(2);
  });

  it("excludes a row with no declared zone key, without calling zoneCentroid on it", () => {
    const rows: MissMarginInput[] = [
      {
        intendedTargetNumber: 20,
        intendedZoneKey: null,
        locationX: 0,
        locationY: -166,
      },
      ...darts([{ dx: 1, dy: 1 }]),
    ];
    const prior = foldPopulationPrior(rows);
    expect(prior.sampleSize).toBe(1);
    expect(prior.excludedCount).toBe(1);
  });

  it("returns a zeroed prior for an empty extract", () => {
    const prior = foldPopulationPrior([]);
    expect(prior).toEqual({
      sigmaAlongMm: 0,
      sigmaAcrossMm: 0,
      biasXMm: 0,
      biasYMm: 0,
      outlierRate: 0,
      sampleSize: 0,
      excludedCount: 0,
    });
  });
});
