import { describe, expect, it } from "vitest";
import {
  deriveFlatSpotValues,
  interiorPoints,
  SPOTS,
} from "../../scripts/dartbot-bias-flatspot-fix";
import { LEVEL_SKILL_TABLE } from "../../src/modules/dartbot/skill-profile.module";

describe("interiorPoints", () => {
  it("returns steps - 1 interior points", () => {
    expect(interiorPoints(1, 8, 3)).toHaveLength(2);
    expect(interiorPoints(1, 16, 4)).toHaveLength(3);
  });

  it("excludes both endpoints", () => {
    const points = interiorPoints(1, 8, 3);
    expect(points).not.toContain(1);
    expect(points).not.toContain(8);
  });

  it("is geometric (equal successive ratios), not the linear midpoint", () => {
    expect(interiorPoints(1, 8, 3)).toEqual([4, 2]);
  });

  it("holds a constant ratio across more than two interior points", () => {
    const points = interiorPoints(1, 16, 4);
    expect(points).toEqual([8, 4, 2]);
    expect(points[0] / points[1]).toBeCloseTo(points[1] / points[2], 10);
  });
});

describe("deriveFlatSpotValues", () => {
  const resolved = deriveFlatSpotValues();
  const derivedLevels: number[] = [
    ...new Set(SPOTS.flatMap((spot) => spot.levels)),
  ].sort((a, b) => a - b);

  /**
   * Bias values for `level`, reading from the freshly derived table for the
   * six flat-spot levels and from the untouched `LEVEL_SKILL_TABLE` for
   * their bracketing neighbours — so the checks below compare against real
   * neighbour values rather than assuming which levels moved.
   */
  function biasAt(level: number): { biasXMm: number; biasYMm: number } {
    if (derivedLevels.includes(level)) {
      return {
        biasXMm: resolved.biasXMm[level],
        biasYMm: resolved.biasYMm[level],
      };
    }
    const row = LEVEL_SKILL_TABLE[level];
    return { biasXMm: row.biasXMm, biasYMm: row.biasYMm };
  }

  it("differs from both neighbours in at least one bias field, for every derived level", () => {
    for (const level of derivedLevels) {
      const current = biasAt(level);
      const prev = biasAt(level - 1);
      const next = biasAt(level + 1);
      expect(
        current.biasXMm !== prev.biasXMm || current.biasYMm !== prev.biasYMm,
      ).toBe(true);
      expect(
        current.biasXMm !== next.biasXMm || current.biasYMm !== next.biasYMm,
      ).toBe(true);
    }
  });

  it("strictly decreases biasXMm from level 7 through 14", () => {
    const series = [7, 8, 9, 10, 11, 12, 13, 14].map(
      (level) => biasAt(level).biasXMm,
    );
    for (let i = 1; i < series.length; i++) {
      expect(series[i]).toBeLessThan(series[i - 1]);
    }
  });

  it("strictly decreases biasYMm from level 6 through 15", () => {
    const series = [6, 7, 8, 9, 10, 11, 12, 13, 14, 15].map(
      (level) => biasAt(level).biasYMm,
    );
    for (let i = 1; i < series.length; i++) {
      expect(series[i]).toBeLessThan(series[i - 1]);
    }
  });

  it("never derives a negative bias value", () => {
    for (const level of derivedLevels) {
      const { biasXMm, biasYMm } = biasAt(level);
      expect(biasXMm).toBeGreaterThanOrEqual(0);
      expect(biasYMm).toBeGreaterThanOrEqual(0);
    }
  });
});
