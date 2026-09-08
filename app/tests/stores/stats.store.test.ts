import { beforeEach, describe, expect, it, vi } from "vitest";

const fetchStatisticsOverview = vi.fn();

vi.mock("@client/api/statistics", () => ({
  fetchStatisticsOverview: () => fetchStatisticsOverview(),
}));

const { statsStore } = await import("@stores/stats.store");

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

beforeEach(() => {
  fetchStatisticsOverview.mockReset();
});

describe("statsStore", () => {
  it("loads and formats the overview", async () => {
    fetchStatisticsOverview.mockResolvedValue(SAMPLE);

    const store = statsStore();
    await store.load();

    expect(store.totalGamesPlayed).toBe("12");
    expect(store.totalPlayTimeSeconds).toBe("1h 0m");
    expect(store.favoriteGameTypeKey).toBe("501");
    expect(store.currentPlayStreakDays).toBe("1 day");
    expect(store.longestStreakHint).toBe("Longest: 3 days");
    expect(store.highestCheckoutValue).toBe("100");
    expect(store.highestCheckoutHint).toBe("Hit 2×");
    expect(store.loading).toBe(false);
    expect(store.error).toBeNull();
  });

  it("loads on init so a registered store hydrates without x-init", async () => {
    fetchStatisticsOverview.mockResolvedValue(SAMPLE);

    const store = statsStore();
    await store.init();

    expect(fetchStatisticsOverview).toHaveBeenCalledTimes(1);
    expect(store.totalGamesPlayed).toBe("12");
  });

  it("keeps blank fields and sets error when the load fails", async () => {
    fetchStatisticsOverview.mockRejectedValue(new Error("offline"));

    const store = statsStore();
    await store.load();

    expect(store.totalGamesPlayed).toBe("");
    expect(store.error).not.toBeNull();
    expect(store.loading).toBe(false);
  });
});
