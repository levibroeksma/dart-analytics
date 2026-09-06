import { describe, it, expect } from "vitest";
import { StatisticsOverviewResponse } from "@routes/types";

describe("StatisticsOverviewResponse", () => {
  it("parses a full response with no data yet", () => {
    const result = StatisticsOverviewResponse.safeParse({
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
    });
    expect(result.success).toBe(true);
  });

  it("parses a full response with real history", () => {
    const result = StatisticsOverviewResponse.safeParse({
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
    });
    expect(result.success).toBe(true);
  });

  it("rejects a doubleAccuracy outside 0..1", () => {
    const result = StatisticsOverviewResponse.safeParse({
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
      doubleAccuracy: 1.5,
      highestCheckout: null,
    });
    expect(result.success).toBe(false);
  });
});
