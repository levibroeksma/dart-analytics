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
  TargetAccuracySeriesResponse,
  ConfusionSeriesResponse,
  LooseDartsSeriesResponse,
  GroupingSeriesResponse,
  MissDirectionSeriesResponse,
  HeatmapSeriesResponse,
  CheckoutRateSeriesResponse,
  DoublePerformanceSeriesResponse,
  CheckoutPathSeriesResponse,
  BustRateSeriesResponse,
  LegStatsSeriesResponse,
  LadderProgressSeriesResponse,
  ScoringTrendSeriesResponse,
  TrebleRateSeriesResponse,
  AtcDartsPerTargetSeriesResponse,
  Bobs27SurvivalSeriesResponse,
  ShanghaiCountSeriesResponse,
  ReplayQuery,
  ReplaySessionIdParam,
  ReplayHeaderSchema,
  ReplayTurnSchema,
  ReplayPageSchema,
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

  it("accepts a valid target", () => {
    const result = StatisticsRangeQuery.safeParse({
      from: "2026-01-01T00:00:00+01:00",
      to: "2026-09-01T00:00:00+01:00",
      target: "DOUBLE:16",
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.target).toBe("DOUBLE:16");
  });

  it("rejects an out-of-range target, naming target", () => {
    const result = StatisticsRangeQuery.safeParse({
      from: "2026-01-01T00:00:00+01:00",
      to: "2026-09-01T00:00:00+01:00",
      target: "DOUBLE:21",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toEqual(["target"]);
    }
  });

  it("omits target when not given", () => {
    const result = StatisticsRangeQuery.safeParse({
      from: "2026-01-01T00:00:00+01:00",
      to: "2026-09-01T00:00:00+01:00",
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.target).toBeUndefined();
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

describe("board section series responses", () => {
  it("parses a target-accuracy series response", () => {
    const result = TargetAccuracySeriesResponse.safeParse({
      sectionId: "target-accuracy",
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
          sampleSize: 30,
          metrics: { "DOUBLE:16": { attempts: 30, hits: 9 } },
        },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("parses a target-accuracy series response with skippedSessions (derived, server site)", () => {
    const result = TargetAccuracySeriesResponse.safeParse({
      sectionId: "target-accuracy",
      sectionVersion: 1,
      dataVersion: "v1:1:0",
      bucket: "month",
      tz: "Europe/Amsterdam",
      range: { from: "2026-01-01T00:00:00Z", to: "2026-02-01T00:00:00Z" },
      skippedSessions: 2,
      buckets: [
        {
          start: "2026-01-01T00:00:00Z",
          end: "2026-02-01T00:00:00Z",
          closed: true,
          sampleSize: 30,
          metrics: { "NUMBER:20": { attempts: 30, hits: 9 } },
        },
      ],
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.skippedSessions).toBe(2);
  });

  it("parses a confusion series response with a MISS hit key", () => {
    const result = ConfusionSeriesResponse.safeParse({
      sectionId: "confusion",
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
          sampleSize: 6,
          metrics: {
            "DOUBLE:16": { "DOUBLE:16": 3, "DOUBLE:8": 2, MISS: 1 },
          },
        },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("parses a loose-darts series response", () => {
    const result = LooseDartsSeriesResponse.safeParse({
      sectionId: "loose-darts",
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
          sampleSize: 30,
          metrics: {
            "DOUBLE:16": { onTarget: 9, nearMiss: 12, loose: 9 },
          },
        },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("parses a grouping series response", () => {
    const result = GroupingSeriesResponse.safeParse({
      sectionId: "grouping",
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
          sampleSize: 30,
          metrics: {
            "DOUBLE:16": {
              n: 30,
              sumX: 12.5,
              sumY: -8.2,
              sumXX: 400.1,
              sumYY: 380.4,
              sumXY: -20.3,
            },
          },
        },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("parses a miss-direction series response", () => {
    const result = MissDirectionSeriesResponse.safeParse({
      sectionId: "miss-direction",
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
          sampleSize: 21,
          metrics: {
            "DOUBLE:16": [
              { sector: 0, radial: "WITHIN", darts: 5 },
              { sector: 4, radial: "OUTSIDE", darts: 2 },
            ],
          },
        },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("parses a heatmap series response", () => {
    const result = HeatmapSeriesResponse.safeParse({
      sectionId: "heatmap",
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
          sampleSize: 500,
          metrics: {
            cellMm: 5,
            target: "DOUBLE:16",
            cells: [
              [0, 0, 12],
              [1, -1, 4],
            ],
          },
        },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("rejects a heatmap cell with a non-integer index", () => {
    const result = HeatmapSeriesResponse.safeParse({
      sectionId: "heatmap",
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
          sampleSize: 1,
          metrics: {
            cellMm: 5,
            target: null,
            cells: [[0.5, 0, 1]],
          },
        },
      ],
    });
    expect(result.success).toBe(false);
  });
});

describe("checkout family series responses", () => {
  it("parses a checkout-rate series response", () => {
    const result = CheckoutRateSeriesResponse.safeParse({
      sectionId: "checkout-rate",
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
          sampleSize: 4,
          metrics: { "170": { chances: 4, finished: 1 } },
        },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("rejects a checkout-rate metrics key that is not a plain integer", () => {
    const result = CheckoutRateSeriesResponse.safeParse({
      sectionId: "checkout-rate",
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
          sampleSize: 1,
          metrics: { abc: { chances: 1, finished: 0 } },
        },
      ],
    });
    expect(result.success).toBe(false);
  });

  it("parses a double-performance series response", () => {
    const result = DoublePerformanceSeriesResponse.safeParse({
      sectionId: "double-performance",
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
          sampleSize: 30,
          metrics: { "DOUBLE:16": { attempts: 30, hits: 12 } },
        },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("parses a checkout-path series response", () => {
    const result = CheckoutPathSeriesResponse.safeParse({
      sectionId: "checkout-path",
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
          sampleSize: 4,
          metrics: {
            "170": { "T20 T20 BULL": { visits: 3, finished: 1 } },
            "81": { "T19 D12": { visits: 1, finished: 1 } },
          },
        },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("rejects a checkout-path outer key that is not a plain integer", () => {
    const result = CheckoutPathSeriesResponse.safeParse({
      sectionId: "checkout-path",
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
          sampleSize: 1,
          metrics: { abc: { "T20 T20 BULL": { visits: 1, finished: 0 } } },
        },
      ],
    });
    expect(result.success).toBe(false);
  });

  it("parses a bust-rate series response", () => {
    const result = BustRateSeriesResponse.safeParse({
      sectionId: "bust-rate",
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
          sampleSize: 2,
          metrics: { "40": { visits: 2, busts: 1 } },
        },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("rejects a bust-rate metrics key that is not a plain integer", () => {
    const result = BustRateSeriesResponse.safeParse({
      sectionId: "bust-rate",
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
          sampleSize: 1,
          metrics: { abc: { visits: 1, busts: 0 } },
        },
      ],
    });
    expect(result.success).toBe(false);
  });

  it("parses a leg-stats series response", () => {
    const result = LegStatsSeriesResponse.safeParse({
      sectionId: "leg-stats",
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
          sampleSize: 1,
          metrics: { "18": 1 },
        },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("rejects a leg-stats metrics key that is not a plain integer", () => {
    const result = LegStatsSeriesResponse.safeParse({
      sectionId: "leg-stats",
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
          sampleSize: 1,
          metrics: { abc: 1 },
        },
      ],
    });
    expect(result.success).toBe(false);
  });

  it("parses a ladder-progress series response", () => {
    const result = LadderProgressSeriesResponse.safeParse({
      sectionId: "ladder-progress",
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
          sampleSize: 3,
          metrics: {
            targets: { "41": { attempts: 1, successes: 1 } },
            maxTarget: 51,
            afterMiss: 1,
            recovered: 1,
          },
        },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("rejects a ladder-progress bucket missing maxTarget", () => {
    const result = LadderProgressSeriesResponse.safeParse({
      sectionId: "ladder-progress",
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
          sampleSize: 3,
          metrics: {
            targets: { "41": { attempts: 1, successes: 1 } },
            afterMiss: 1,
            recovered: 1,
          },
        },
      ],
    });
    expect(result.success).toBe(false);
  });

  it("parses a scoring-trend series response", () => {
    const result = ScoringTrendSeriesResponse.safeParse({
      sectionId: "scoring-trend",
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
          sampleSize: 10,
          metrics: {
            points: 450,
            darts: 90,
            firstNinePoints: 150,
            firstNineDarts: 27,
            bands: { ton: 3, tonForty: 1, oneEighty: 0 },
          },
        },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("parses a treble-rate series response with a MISS key", () => {
    const result = TrebleRateSeriesResponse.safeParse({
      sectionId: "treble-rate",
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
          sampleSize: 90,
          metrics: {
            "20": { darts: 40, trebles: 10 },
            "25": { darts: 5, trebles: 0 },
            MISS: { darts: 3, trebles: 0 },
          },
        },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("rejects a treble-rate key that is neither a number nor MISS", () => {
    const result = TrebleRateSeriesResponse.safeParse({
      sectionId: "treble-rate",
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
          sampleSize: 1,
          metrics: { bogey: { darts: 1, trebles: 0 } },
        },
      ],
    });
    expect(result.success).toBe(false);
  });
});

describe("derived and game-specific series responses", () => {
  it("parses an atc-darts-per-target series response with skippedSessions", () => {
    const result = AtcDartsPerTargetSeriesResponse.safeParse({
      sectionId: "atc-darts-per-target",
      sectionVersion: 1,
      dataVersion: "v1:1:0",
      bucket: "none",
      tz: null,
      range: { from: "2026-01-01T00:00:00Z", to: "2026-02-01T00:00:00Z" },
      skippedSessions: 1,
      buckets: [
        {
          start: "2026-01-01T00:00:00Z",
          end: "2026-02-01T00:00:00Z",
          closed: true,
          sampleSize: 4,
          metrics: {
            "AROUND_THE_CLOCK_V2|difficulty=HARD|segment_rule=ANY": {
              "NUMBER:1": { darts: 3, cleared: 1 },
            },
          },
        },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("parses a bobs27-survival series response", () => {
    const result = Bobs27SurvivalSeriesResponse.safeParse({
      sectionId: "bobs27-survival",
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
          sampleSize: 2,
          metrics: {
            "BOBS27_V1|start_score=27|miss_penalty_multiplier=1|bull_hit_value=25":
              {
                runs: 2,
                completed: 1,
                reached: { "DOUBLE:1": 2, "DOUBLE:2": 1 },
                died: { "DOUBLE:2": 1 },
                scoreAfter: {
                  "DOUBLE:1": { runs: 2, sum: 40, min: 15, max: 25 },
                },
              },
          },
        },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("parses a shanghai-count series response", () => {
    const result = ShanghaiCountSeriesResponse.safeParse({
      sectionId: "shanghai-count",
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
            sessions: 5,
            shanghais: 1,
            byRound: { "3": 1 },
          },
        },
      ],
    });
    expect(result.success).toBe(true);
  });
});

describe("ReplayQuery", () => {
  it("defaults limit to 30 with no cursor", () => {
    const result = ReplayQuery.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.limit).toBe(30);
      expect(result.data.cursor).toBeUndefined();
    }
  });

  it("accepts a cursor and an in-range limit", () => {
    const result = ReplayQuery.safeParse({ cursor: "v1:abc:2", limit: "50" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.cursor).toBe("v1:abc:2");
      expect(result.data.limit).toBe(50);
    }
  });

  it("rejects limit=0", () => {
    expect(ReplayQuery.safeParse({ limit: "0" }).success).toBe(false);
  });

  it("rejects limit=121", () => {
    expect(ReplayQuery.safeParse({ limit: "121" }).success).toBe(false);
  });

  it("rejects a statistics-range param this route does not accept (decision 6)", () => {
    expect(
      ReplayQuery.safeParse({ from: "2026-01-01T00:00:00+01:00" }).success,
    ).toBe(false);
  });

  it("rejects an unrecognized param", () => {
    expect(ReplayQuery.safeParse({ foo: "1" }).success).toBe(false);
  });
});

describe("ReplaySessionIdParam", () => {
  it("accepts a UUID", () => {
    expect(
      ReplaySessionIdParam.safeParse("018f1e2a-0000-7000-8000-000000000000")
        .success,
    ).toBe(true);
  });

  it("rejects a non-UUID", () => {
    expect(ReplaySessionIdParam.safeParse("not-a-uuid").success).toBe(false);
  });
});

describe("replay page schemas", () => {
  const header = {
    sessionId: "018f1e2a-0000-7000-8000-000000000000",
    gameTypeKey: "501",
    rulesetVersionKey: "501_V1",
    inputModeKey: "VISUAL_BOARD",
    statusKey: "COMPLETED",
    contextKey: "STANDALONE",
    activityId: "018f1e2a-0000-7000-8000-000000000001",
    routineStepSequenceNumber: null,
    configuration: null,
    startedAt: "2026-01-01T00:00:00.000Z",
    completedAt: "2026-01-01T00:05:00.000Z",
    durationSeconds: 300,
    turnCount: 1,
    dartCount: 1,
    participants: [
      {
        participantId: "018f1e2a-0000-7000-8000-000000000002",
        displayName: "Levi",
        participantTypeKey: "PLAYER",
      },
    ],
    stages: [
      {
        stageId: "018f1e2a-0000-7000-8000-000000000003",
        parentStageId: null,
        stageTypeKey: "LEG",
        sequence: 1,
      },
    ],
  };

  const turn = {
    stageId: "018f1e2a-0000-7000-8000-000000000003",
    turnSequence: 1,
    participantId: "018f1e2a-0000-7000-8000-000000000002",
    turnTotalScore: 60,
    darts: [
      {
        dartNumber: 1,
        intendedTargetNumber: null,
        intendedZoneKey: null,
        hitTargetNumber: 20,
        hitZoneKey: "TREBLE",
        score: 60,
        locationX: 12.3,
        locationY: -4.5,
      },
    ],
  };

  it("parses a full header, including a turn-total-only turn", () => {
    expect(ReplayHeaderSchema.safeParse(header).success).toBe(true);
    expect(ReplayTurnSchema.safeParse({ ...turn, darts: [] }).success).toBe(
      true,
    );
  });

  it("parses a first page carrying a header", () => {
    const result = ReplayPageSchema.safeParse({
      header,
      turns: [turn],
      nextCursor: null,
    });
    expect(result.success).toBe(true);
  });

  it("parses a later page carrying a null header and a nextCursor", () => {
    const result = ReplayPageSchema.safeParse({
      header: null,
      turns: [turn],
      nextCursor: "v1:018f1e2a-0000-7000-8000-000000000003:1",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a dart with a null hitZoneKey (R3: real darts always carry one)", () => {
    const result = ReplayTurnSchema.safeParse({
      ...turn,
      darts: [{ ...turn.darts[0], hitZoneKey: null }],
    });
    expect(result.success).toBe(false);
  });
});
