import { describe, expect, it } from "vitest";
import { formatStatisticsOverview } from "@lib/stats/format-statistics-overview";
import type { StatisticsOverviewResponseData } from "@routes/types";

const ZERO: StatisticsOverviewResponseData = {
  totalGamesPlayed: 0,
  totalPlayTimeSeconds: 0,
  favoriteGameTypeKey: null,
  longestPlayStreakDays: 0,
  currentPlayStreakDays: 0,
  totalDartsThrown: 0,
  hundredPlusCount: 0,
  oneTwentyPlusCount: 0,
  oneFortyPlusCount: 0,
  oneEightiesCount: 0,
  medianVisitScore: 0,
  highestGameAverage: 0,
  firstNineCareerAverage: 0,
  scoringAverageExcludingDoubles: 0,
  bestLegDarts: null,
  averageDartsPerLeg: null,
  doubleAccuracy: null,
  highestCheckout: null,
};

describe("formatStatisticsOverview", () => {
  it("formats an all-zero/all-null response with placeholder dashes", () => {
    const result = formatStatisticsOverview(ZERO);
    expect(result.totalGamesPlayed).toBe("0");
    expect(result.totalPlayTimeSeconds).toBe("0m");
    expect(result.favoriteGameTypeKey).toBe("—");
    expect(result.currentPlayStreakDays).toBe("0 days");
    expect(result.longestStreakHint).toBe("Longest: 0 days");
    expect(result.bestLegDarts).toBe("—");
    expect(result.averageDartsPerLeg).toBe("—");
    expect(result.doubleAccuracy).toBe("—");
    expect(result.highestCheckoutValue).toBe("—");
    expect(result.highestCheckoutHint).toBe("");
  });

  it("formats a full response with real history", () => {
    const data: StatisticsOverviewResponseData = {
      totalGamesPlayed: 12,
      totalPlayTimeSeconds: 3600,
      favoriteGameTypeKey: "501",
      longestPlayStreakDays: 3,
      currentPlayStreakDays: 1,
      totalDartsThrown: 300,
      hundredPlusCount: 10,
      oneTwentyPlusCount: 5,
      oneFortyPlusCount: 2,
      oneEightiesCount: 1,
      medianVisitScore: 45,
      highestGameAverage: 65.5,
      firstNineCareerAverage: 50.2,
      scoringAverageExcludingDoubles: 48.1,
      bestLegDarts: 15,
      averageDartsPerLeg: 18.5,
      doubleAccuracy: 0.4,
      highestCheckout: { value: 100, timesHit: 2 },
    };
    const result = formatStatisticsOverview(data);
    expect(result.totalGamesPlayed).toBe("12");
    expect(result.totalPlayTimeSeconds).toBe("1h 0m");
    expect(result.favoriteGameTypeKey).toBe("501");
    expect(result.currentPlayStreakDays).toBe("1 day");
    expect(result.longestStreakHint).toBe("Longest: 3 days");
    expect(result.totalDartsThrown).toBe("300");
    expect(result.hundredPlusCount).toBe("10");
    expect(result.oneTwentyPlusCount).toBe("5");
    expect(result.oneFortyPlusCount).toBe("2");
    expect(result.oneEightiesCount).toBe("1");
    expect(result.medianVisitScore).toBe("45.0");
    expect(result.highestGameAverage).toBe("65.5");
    expect(result.firstNineCareerAverage).toBe("50.2");
    expect(result.scoringAverageExcludingDoubles).toBe("48.1");
    expect(result.bestLegDarts).toBe("15 darts");
    expect(result.averageDartsPerLeg).toBe("18.5");
    expect(result.doubleAccuracy).toBe("40%");
    expect(result.highestCheckoutValue).toBe("100");
    expect(result.highestCheckoutHint).toBe("Hit 2×");
  });

  it("falls back to a dash for an unrecognized game type key", () => {
    const result = formatStatisticsOverview({
      ...ZERO,
      favoriteGameTypeKey: "UNKNOWN",
    });
    expect(result.favoriteGameTypeKey).toBe("—");
  });

  it("drops the hour segment under one hour of play time", () => {
    const result = formatStatisticsOverview({
      ...ZERO,
      totalPlayTimeSeconds: 125,
    });
    expect(result.totalPlayTimeSeconds).toBe("2m");
  });

  it("singularizes a one-day streak", () => {
    const result = formatStatisticsOverview({
      ...ZERO,
      longestPlayStreakDays: 1,
    });
    expect(result.longestStreakHint).toBe("Longest: 1 day");
  });

  it("reports a single checkout hit without pluralizing oddly", () => {
    const result = formatStatisticsOverview({
      ...ZERO,
      highestCheckout: { value: 40, timesHit: 1 },
    });
    expect(result.highestCheckoutHint).toBe("Hit 1×");
  });
});
