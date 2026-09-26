import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@client/api/client", () => ({ apiRequest: vi.fn() }));

import { apiRequest } from "@client/api/client";
import {
  fetchStatisticsOverview,
  fetchGameSessions,
  fetchGameSection,
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
  checkoutPercentage: 0.4,
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

describe("fetchGameSessions", () => {
  beforeEach(() => vi.resetAllMocks());

  it("builds the query string and returns the session list", async () => {
    const listResponse = { items: [], nextCursor: null, dataVersion: "v1:0:0" };
    vi.mocked(apiRequest).mockResolvedValue({
      ok: true,
      requestId: "r1",
      data: listResponse,
    });

    const result = await fetchGameSessions("501", {
      from: "2026-01-01T00:00:00.000Z",
      to: "2026-02-01T00:00:00.000Z",
      bucket: "month",
      tz: "Europe/Amsterdam",
      limit: 10,
    });

    expect(result).toEqual(listResponse);
    const [path] = vi.mocked(apiRequest).mock.calls[0];
    expect(path).toContain("/api/statistics/games/501/sessions?");
    expect(path).toContain("from=2026-01-01T00%3A00%3A00.000Z");
    expect(path).toContain("to=2026-02-01T00%3A00%3A00.000Z");
    expect(path).toContain("bucket=month");
    expect(path).toContain("tz=Europe%2FAmsterdam");
    expect(path).toContain("limit=10");
  });

  it("throws StatisticsApiError on failure", async () => {
    vi.mocked(apiRequest).mockResolvedValue({
      ok: false,
      requestId: "r1",
      error: { code: "NOT_FOUND", message: "not found", retryable: false },
    });

    await expect(
      fetchGameSessions("501", {
        from: "2026-01-01T00:00:00.000Z",
        to: "2026-02-01T00:00:00.000Z",
      }),
    ).rejects.toBeInstanceOf(StatisticsApiError);
  });
});

describe("fetchGameSection", () => {
  beforeEach(() => vi.resetAllMocks());

  it("builds the query string and returns the section response", async () => {
    const seriesResponse = {
      sectionId: "completion",
      sectionVersion: 1,
      dataVersion: "v1:0:0",
      bucket: "month",
      tz: "Europe/Amsterdam",
      range: {
        from: "2026-01-01T00:00:00.000Z",
        to: "2026-02-01T00:00:00.000Z",
      },
      buckets: [],
    };
    vi.mocked(apiRequest).mockResolvedValue({
      ok: true,
      requestId: "r1",
      data: seriesResponse,
    });

    const result = await fetchGameSection("501", "completion", {
      from: "2026-01-01T00:00:00.000Z",
      to: "2026-02-01T00:00:00.000Z",
      bucket: "month",
      tz: "Europe/Amsterdam",
    });

    expect(result).toEqual(seriesResponse);
    const [path] = vi.mocked(apiRequest).mock.calls[0];
    expect(path).toContain("/api/statistics/games/501/sections/completion?");
    expect(path).toContain("bucket=month");
  });

  it("throws StatisticsApiError on failure", async () => {
    vi.mocked(apiRequest).mockResolvedValue({
      ok: false,
      requestId: "r1",
      error: { code: "NOT_FOUND", message: "not found", retryable: false },
    });

    await expect(
      fetchGameSection("501", "completion", {
        from: "2026-01-01T00:00:00.000Z",
        to: "2026-02-01T00:00:00.000Z",
      }),
    ).rejects.toBeInstanceOf(StatisticsApiError);
  });
});
