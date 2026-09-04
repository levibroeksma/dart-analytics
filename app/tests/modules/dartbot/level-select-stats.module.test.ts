import { describe, expect, it } from "vitest";
import {
  LEVEL_SELECT_STATS_TABLE,
  allLevelSelectStats,
  levelSelectStatsForLevel,
} from "@modules/dartbot/level-select-stats.module";

describe("levelSelectStatsForLevel", () => {
  it("returns the exact table row for a valid level", () => {
    expect(levelSelectStatsForLevel(8)).toBe(LEVEL_SELECT_STATS_TABLE[8]);
  });

  it("clamps a level below 1 to level 1", () => {
    expect(levelSelectStatsForLevel(0)).toBe(LEVEL_SELECT_STATS_TABLE[1]);
  });

  it("clamps a level above 15 to level 15", () => {
    expect(levelSelectStatsForLevel(20)).toBe(LEVEL_SELECT_STATS_TABLE[15]);
  });

  it("defines all fifteen levels", () => {
    expect(Object.keys(LEVEL_SELECT_STATS_TABLE)).toHaveLength(15);
  });

  it("every level's low bound never exceeds its high bound", () => {
    for (let level = 1; level <= 15; level++) {
      const stats = levelSelectStatsForLevel(level);
      expect(stats.averageLow).toBeLessThanOrEqual(stats.averageHigh);
      expect(stats.checkoutLow).toBeLessThanOrEqual(stats.checkoutHigh);
    }
  });

  it("checkout bounds stay within 0..100", () => {
    for (let level = 1; level <= 15; level++) {
      const stats = levelSelectStatsForLevel(level);
      expect(stats.checkoutLow).toBeGreaterThanOrEqual(0);
      expect(stats.checkoutHigh).toBeLessThanOrEqual(100);
    }
  });

  it("allLevelSelectStats returns the same table reference", () => {
    expect(allLevelSelectStats()).toBe(LEVEL_SELECT_STATS_TABLE);
  });

  it("level 15's average band is not degenerate at the 180 ceiling (D-N)", () => {
    const level15 = levelSelectStatsForLevel(15);
    expect(level15.averageLow).toBeLessThan(level15.averageHigh);
    expect(level15.averageLow).toBeLessThan(180);
  });
});
