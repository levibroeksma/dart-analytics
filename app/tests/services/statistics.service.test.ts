import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@db/client", () => ({ getDb: vi.fn(() => ({})) }));
vi.mock("@repositories/statistics.repository", () => ({
  findSessionSummaries: vi.fn(),
  findVisitFacts: vi.fn(),
  findLegFacts: vi.fn(),
  findDoubleOutVisits: vi.fn(),
}));

import * as repo from "@repositories/statistics.repository";
import { getStatisticsOverview } from "@services/statistics.service";

const playerId = "0198f200-0000-7000-8000-000000000001";

describe("getStatisticsOverview", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns all-zero/null stats when the player has no history", async () => {
    vi.mocked(repo.findSessionSummaries).mockResolvedValue([]);
    vi.mocked(repo.findVisitFacts).mockResolvedValue([]);
    vi.mocked(repo.findLegFacts).mockResolvedValue([]);
    vi.mocked(repo.findDoubleOutVisits).mockResolvedValue([]);

    const result = await getStatisticsOverview(playerId);

    expect(result).toEqual({
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
  });

  it("composes real history through every module", async () => {
    vi.mocked(repo.findSessionSummaries).mockResolvedValue([
      {
        gameTypeKey: "501",
        statusKey: "COMPLETED",
        startedAt: "2026-09-01T10:00:00.000Z",
        durationSeconds: 600,
      },
    ]);
    vi.mocked(repo.findVisitFacts).mockResolvedValue([
      {
        sessionId: "s1",
        gameTypeKey: "501",
        stageId: "stage-1",
        stageTypeKey: "LEG",
        turnSequence: 1,
        totalScore: 180,
        dartCount: 3,
        configuredMaxDartsPerTurn: 3,
      },
    ]);
    vi.mocked(repo.findLegFacts).mockResolvedValue([
      {
        sessionId: "s1",
        gameTypeKey: "501",
        stageId: "stage-1",
        totalDartsInLeg: 9,
      },
    ]);
    vi.mocked(repo.findDoubleOutVisits).mockResolvedValue([]);

    const result = await getStatisticsOverview(playerId);

    expect(result.totalGamesPlayed).toBe(1);
    expect(result.favoriteGameTypeKey).toBe("501");
    expect(result.oneEightiesCount).toBe(1);
    expect(result.bestLegDarts).toBe(9);
    expect(result.doubleAccuracy).toBeNull();
    expect(result.highestCheckout).toBeNull();
  });

  it("computes doubleAccuracy from classified double-out visits", async () => {
    vi.mocked(repo.findSessionSummaries).mockResolvedValue([]);
    vi.mocked(repo.findVisitFacts).mockResolvedValue([]);
    vi.mocked(repo.findLegFacts).mockResolvedValue([]);
    vi.mocked(repo.findDoubleOutVisits).mockResolvedValue([
      {
        startingRemaining: 40,
        darts: [
          {
            sequence: 1,
            intendedTargetNumber: null,
            intendedZoneKey: null,
            hitTargetNumber: 20,
            hitZoneKey: "DOUBLE",
            score: 40,
            locationX: null,
            locationY: null,
          },
        ],
      },
    ]);

    const result = await getStatisticsOverview(playerId);

    expect(result.doubleAccuracy).toBe(1);
    expect(result.highestCheckout).toEqual({ value: 40, timesHit: 1 });
  });
});
