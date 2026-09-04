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
