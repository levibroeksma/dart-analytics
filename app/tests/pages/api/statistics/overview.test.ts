import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@services/statistics.service", () => ({
  getStatisticsOverview: vi.fn(),
}));

import { getStatisticsOverview } from "@services/statistics.service";
import { GET } from "@routes/statistics/overview";

const locals = {
  requestId: "req-1",
  auth: { authUserId: "auth-1", playerId: "player-1" },
};

describe("GET /api/statistics/overview", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns the caller's statistics overview", async () => {
    const overview = {
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
    vi.mocked(getStatisticsOverview).mockResolvedValue(overview);

    const response = await GET({ locals } as never);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data).toEqual(overview);
    expect(getStatisticsOverview).toHaveBeenCalledWith("player-1");
  });
});
