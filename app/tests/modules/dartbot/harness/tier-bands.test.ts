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
    expect(s.threeDartAverage).toBeGreaterThanOrEqual(27);
    expect(s.threeDartAverage).toBeLessThanOrEqual(45);
    expect(s.checkoutRate).toBeGreaterThanOrEqual(0.03);
    expect(s.checkoutRate).toBeLessThanOrEqual(0.06);
    expect(s.trebleRate).toBeGreaterThanOrEqual(0.07);
    expect(s.trebleRate).toBeLessThanOrEqual(0.12);
    expect(s.missRate).toBeGreaterThanOrEqual(0.045);
    expect(s.missRate).toBeLessThanOrEqual(0.085);
  });

  it("level 8 sits in the mid band", () => {
    const s = stats(8);
    expect(s.threeDartAverage).toBeGreaterThanOrEqual(41);
    expect(s.threeDartAverage).toBeLessThanOrEqual(68);
    expect(s.checkoutRate).toBeGreaterThanOrEqual(0.12);
    expect(s.checkoutRate).toBeLessThanOrEqual(0.2);
    expect(s.trebleRate).toBeGreaterThanOrEqual(0.15);
    expect(s.trebleRate).toBeLessThanOrEqual(0.25);
    expect(s.missRate).toBeGreaterThanOrEqual(0.004);
    expect(s.missRate).toBeLessThanOrEqual(0.012);
  });

  it("level 15 sits in the elite band", () => {
    const s = stats(15);
    expect(s.threeDartAverage).toBeGreaterThanOrEqual(86);
    expect(s.threeDartAverage).toBeLessThanOrEqual(144);
    expect(s.checkoutRate).toBeGreaterThanOrEqual(0.36);
    expect(s.checkoutRate).toBeLessThanOrEqual(0.61);
    expect(s.trebleRate).toBeGreaterThanOrEqual(0.36);
    expect(s.trebleRate).toBeLessThanOrEqual(0.6);
    expect(s.missRate).toBeGreaterThanOrEqual(0);
    expect(s.missRate).toBeLessThanOrEqual(0.003);
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
