import { describe, it, expect } from "vitest";
import {
  StatisticsOverviewResponse,
  StatisticsRangeQuery,
  SessionListQuery,
  MAX_BUCKETS,
  GameSessionListResponse,
  CompletionSeriesResponse,
  VolumeSeriesResponse,
  SessionResultSeriesResponse,
} from "@routes/types";

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
      checkoutPercentage: null,
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
      checkoutPercentage: 0.4,
      highestCheckout: { value: 100, timesHit: 2 },
    });
    expect(result.success).toBe(true);
  });

  it("rejects a checkoutPercentage outside 0..1", () => {
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
      checkoutPercentage: 1.5,
      highestCheckout: null,
    });
    expect(result.success).toBe(false);
  });
});

describe("StatisticsRangeQuery", () => {
  it("accepts a valid month query with tz", () => {
    const result = StatisticsRangeQuery.safeParse({
      from: "2026-01-01T00:00:00+01:00",
      to: "2026-09-01T00:00:00+01:00",
      bucket: "month",
      tz: "Europe/Amsterdam",
    });
    expect(result.success).toBe(true);
  });

  it("accepts bucket=none without tz", () => {
    const result = StatisticsRangeQuery.safeParse({
      from: "2026-01-01T00:00:00+01:00",
      to: "2026-09-01T00:00:00+01:00",
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.bucket).toBe("none");
  });

  it("rejects a missing from", () => {
    const result = StatisticsRangeQuery.safeParse({
      to: "2026-09-01T00:00:00+01:00",
    });
    expect(result.success).toBe(false);
  });

  it("rejects from >= to", () => {
    const result = StatisticsRangeQuery.safeParse({
      from: "2026-09-01T00:00:00+01:00",
      to: "2026-01-01T00:00:00+01:00",
    });
    expect(result.success).toBe(false);
  });

  it("rejects an unknown tz", () => {
    const result = StatisticsRangeQuery.safeParse({
      from: "2026-01-01T00:00:00+01:00",
      to: "2026-09-01T00:00:00+01:00",
      bucket: "month",
      tz: "Mars/Base",
    });
    expect(result.success).toBe(false);
  });

  it("rejects bucket=month with no tz", () => {
    const result = StatisticsRangeQuery.safeParse({
      from: "2026-01-01T00:00:00+01:00",
      to: "2026-09-01T00:00:00+01:00",
      bucket: "month",
    });
    expect(result.success).toBe(false);
  });

  it("rejects an inputMode other than VISUAL_BOARD", () => {
    const result = StatisticsRangeQuery.safeParse({
      from: "2026-01-01T00:00:00+01:00",
      to: "2026-09-01T00:00:00+01:00",
      inputMode: "QUICK_SCORE",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a bucket=day span estimated over the cap", () => {
    const result = StatisticsRangeQuery.safeParse({
      from: "2026-01-01T00:00:00Z",
      to: "2026-07-20T00:00:00Z",
      bucket: "day",
      tz: "UTC",
    });
    expect(result.success).toBe(false);
  });

  it("accepts a bucket=month span of 10 years", () => {
    const result = StatisticsRangeQuery.safeParse({
      from: "2016-01-01T00:00:00Z",
      to: "2026-01-01T00:00:00Z",
      bucket: "month",
      tz: "UTC",
    });
    expect(result.success).toBe(true);
  });
});

describe("SessionListQuery", () => {
  it("rejects limit=0", () => {
    const result = SessionListQuery.safeParse({
      from: "2026-01-01T00:00:00+01:00",
      to: "2026-09-01T00:00:00+01:00",
      limit: 0,
    });
    expect(result.success).toBe(false);
  });

  it("defaults limit to 25", () => {
    const result = SessionListQuery.safeParse({
      from: "2026-01-01T00:00:00+01:00",
      to: "2026-09-01T00:00:00+01:00",
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.limit).toBe(25);
  });
});

describe("MAX_BUCKETS", () => {
  it("is 120", () => {
    expect(MAX_BUCKETS).toBe(120);
  });
});

describe("statistics response schemas", () => {
  it("parses a session list response", () => {
    const result = GameSessionListResponse.safeParse({
      items: [
        {
          sessionId: "018f1e2a-0000-7000-8000-000000000000",
          rulesetVersionKey: "501_V1",
          statusKey: "COMPLETED",
          contextKey: "STANDALONE",
          neverStarted: false,
          startedAt: "2026-01-01T00:00:00Z",
          completedAt: "2026-01-01T00:05:00Z",
          durationSeconds: 300,
          turnCount: 10,
          dartCount: 30,
          countedScore: 501,
        },
      ],
      nextCursor: null,
      dataVersion: "v1:1:0",
    });
    expect(result.success).toBe(true);
  });

  it("parses a completion series response", () => {
    const result = CompletionSeriesResponse.safeParse({
      sectionId: "completion",
      sectionVersion: 1,
      dataVersion: "v1:1:0",
      bucket: "month",
      tz: "Europe/Amsterdam",
      range: { from: "2026-01-01T00:00:00Z", to: "2026-02-01T00:00:00Z" },
      buckets: [
        {
          start: "2026-01-01T00:00:00Z",
          end: "2026-02-01T00:00:00Z",
          closed: true,
          sampleSize: 5,
          metrics: {
            completed: 3,
            abandoned: 1,
            neverStarted: 1,
            abandonedTurns: 4,
          },
        },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("parses a volume series response", () => {
    const result = VolumeSeriesResponse.safeParse({
      sectionId: "volume",
      sectionVersion: 1,
      dataVersion: "v1:1:0",
      bucket: "none",
      tz: null,
      range: { from: "2026-01-01T00:00:00Z", to: "2026-02-01T00:00:00Z" },
      buckets: [
        {
          start: "2026-01-01T00:00:00Z",
          end: "2026-02-01T00:00:00Z",
          closed: true,
          sampleSize: 5,
          metrics: {
            sessions: { standalone: 4, routine: 1 },
            darts: { standalone: 120, routine: 30 },
            durationSeconds: { standalone: 1200, routine: 300 },
          },
        },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("parses a session-result series response", () => {
    const result = SessionResultSeriesResponse.safeParse({
      sectionId: "session-result",
      sectionVersion: 1,
      dataVersion: "v1:1:0",
      bucket: "month",
      tz: "Europe/Amsterdam",
      range: { from: "2026-01-01T00:00:00Z", to: "2026-02-01T00:00:00Z" },
      buckets: [
        {
          start: "2026-01-01T00:00:00Z",
          end: "2026-02-01T00:00:00Z",
          closed: true,
          sampleSize: 5,
          metrics: {
            "501_V1": {
              sessions: 5,
              countedScoreSum: 2505,
              dartSum: 150,
              turnSum: 50,
              countedScoreMin: 400,
              countedScoreMax: 601,
              bestLowSessionId: "018f1e2a-0000-7000-8000-000000000001",
              bestHighSessionId: "018f1e2a-0000-7000-8000-000000000002",
            },
          },
        },
      ],
    });
    expect(result.success).toBe(true);
  });
});
