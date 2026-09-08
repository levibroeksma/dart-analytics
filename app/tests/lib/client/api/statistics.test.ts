import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@client/api/client", () => ({ apiRequest: vi.fn() }));

import { apiRequest } from "@client/api/client";
import {
  fetchStatisticsOverview,
  StatisticsApiError,
} from "@client/api/statistics";

const SAMPLE = {
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

describe("fetchStatisticsOverview", () => {
  beforeEach(() => vi.resetAllMocks());

  it("returns the parsed overview on success", async () => {
    vi.mocked(apiRequest).mockResolvedValue({
      ok: true,
      requestId: "r1",
      data: SAMPLE,
    });
    const result = await fetchStatisticsOverview();
    expect(result.totalGamesPlayed).toBe(12);
    expect(apiRequest).toHaveBeenCalledWith("/api/statistics/overview");
  });

  it("throws StatisticsApiError on failure", async () => {
    vi.mocked(apiRequest).mockResolvedValue({
      ok: false,
      requestId: "r1",
      error: {
        code: "UNAUTHORIZED",
        message: "Authentication required",
        retryable: false,
      },
    });
    await expect(fetchStatisticsOverview()).rejects.toBeInstanceOf(
      StatisticsApiError,
    );
  });
});
