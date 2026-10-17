import { describe, expect, it } from "vitest";
import { simulateTierStats } from "./simulate-tier";

const BASE_SEED = 700000;
const VISITS = 5000;
const ALL_LEVELS = Array.from({ length: 15 }, (_, i) => i + 1);

function stats(level: number) {
  return simulateTierStats(level, BASE_SEED + level, VISITS);
}

describe("tier calibration — sanity bands", () => {
  it("level 1 sits in the beginner band", () => {
    const s = stats(1);
    expect(s.threeDartAverage).toBeGreaterThanOrEqual(26);
    expect(s.threeDartAverage).toBeLessThanOrEqual(40);
    expect(s.checkoutRate).toBeGreaterThanOrEqual(0.008);
    expect(s.checkoutRate).toBeLessThanOrEqual(0.04);
    expect(s.trebleRate).toBeGreaterThanOrEqual(0.025);
    expect(s.trebleRate).toBeLessThanOrEqual(0.065);
    expect(s.missRate).toBeGreaterThanOrEqual(0.08);
    expect(s.missRate).toBeLessThanOrEqual(0.2);
  });

  /**
   * Re-derived for the v2 curve (D-O) from level 8's measured stats at this
   * seed (average 51.2, checkout 0.109, treble 0.137, miss 0.0038), using the
   * old band's own margins around its measured value (anchor log,
   * 2026-09-18 row): average ×0.826–×1.288, checkout ×0.79–×1.58, treble
   * ×0.897–×1.494. The miss ceiling is 2× measured, because the owner-approved
   * 1.8% level-6 wild-dart rate raises miss rates by design.
   */
  it("level 8 sits in the mid band", () => {
    const s = stats(8);
    expect(s.threeDartAverage).toBeGreaterThanOrEqual(42.3);
    expect(s.threeDartAverage).toBeLessThanOrEqual(65.9);
    expect(s.checkoutRate).toBeGreaterThanOrEqual(0.086);
    expect(s.checkoutRate).toBeLessThanOrEqual(0.172);
    expect(s.trebleRate).toBeGreaterThanOrEqual(0.123);
    expect(s.trebleRate).toBeLessThanOrEqual(0.205);
    expect(s.missRate).toBeGreaterThanOrEqual(0);
    expect(s.missRate).toBeLessThanOrEqual(0.0076);
  });

  /** The owner's v2 elite point (D-O): a ≈101 average and ≈35% checkout. */
  it("level 15 sits in the elite band", () => {
    const s = stats(15);
    expect(s.threeDartAverage).toBeGreaterThanOrEqual(97);
    expect(s.threeDartAverage).toBeLessThanOrEqual(105);
    expect(s.checkoutRate).toBeGreaterThanOrEqual(0.3);
    expect(s.checkoutRate).toBeLessThanOrEqual(0.4);
    expect(s.trebleRate).toBeGreaterThanOrEqual(0.3);
    expect(s.trebleRate).toBeLessThanOrEqual(0.4);
    expect(s.missRate).toBeGreaterThanOrEqual(0);
    expect(s.missRate).toBeLessThanOrEqual(0.01);
  });
});

describe("tier calibration — monotonicity across all 15 levels", () => {
  const allStats = ALL_LEVELS.map(stats);

  it("three-dart average never decreases as level increases", () => {
    for (let i = 1; i < allStats.length; i++) {
      expect(allStats[i]!.threeDartAverage).toBeGreaterThanOrEqual(
        allStats[i - 1]!.threeDartAverage,
      );
    }
  });

  it("checkout rate never decreases as level increases", () => {
    for (let i = 1; i < allStats.length; i++) {
      expect(allStats[i]!.checkoutRate).toBeGreaterThanOrEqual(
        allStats[i - 1]!.checkoutRate,
      );
    }
  });

  it("treble rate never decreases as level increases", () => {
    for (let i = 1; i < allStats.length; i++) {
      expect(allStats[i]!.trebleRate).toBeGreaterThanOrEqual(
        allStats[i - 1]!.trebleRate,
      );
    }
  });

  it("miss rate never increases as level increases", () => {
    for (let i = 1; i < allStats.length; i++) {
      expect(allStats[i]!.missRate).toBeLessThanOrEqual(
        allStats[i - 1]!.missRate,
      );
    }
  });

  it("t20 rate per visit never decreases as level increases", () => {
    for (let i = 1; i < allStats.length; i++) {
      expect(allStats[i]!.t20RatePerVisit).toBeGreaterThanOrEqual(
        allStats[i - 1]!.t20RatePerVisit,
      );
    }
  });
});
