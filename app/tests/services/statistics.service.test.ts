import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@db/client", () => ({ getDb: vi.fn(() => ({})) }));
vi.mock("@repositories/statistics.repository", () => ({
  findSessionSummaries: vi.fn(),
  findVisitFacts: vi.fn(),
  findLegFacts: vi.fn(),
  findX01CheckoutDarts: vi.fn(),
  findGameSessionsPage: vi.fn(),
  findGameDataVersion: vi.fn(),
  findBucketFloor: vi.fn(),
  findBucketedSessionAggregates: vi.fn(),
  findIntentCells: vi.fn(),
  findIntentMoments: vi.fn(),
  findMissSectors: vi.fn(),
  findHeatmapCells: vi.fn(),
  findScopeDartCount: vi.fn(),
  findX01FoldRows: vi.fn(),
  findVisitScoring: vi.fn(),
  findHitNumberCells: vi.fn(),
  findDartFoldRows: vi.fn(),
  findReplaySession: vi.fn(),
  findReplayStages: vi.fn(),
  findReplayParticipants: vi.fn(),
  findReplayTurnPage: vi.fn(),
  findTrainedRoutines: vi.fn(),
  findRoutineHeader: vi.fn(),
  findRoutineStepDescriptors: vi.fn(),
  findRoutineDataVersion: vi.fn(),
  findRoutineRunBuckets: vi.fn(),
  findStepBuckets: vi.fn(),
  findStepSessionPage: vi.fn(),
  findStepFoldRows: vi.fn(),
  findStepScopeDartCount: vi.fn(),
}));

import * as repo from "@repositories/statistics.repository";
import {
  getStatisticsOverview,
  listGameSessions,
  getGameSection,
  getSessionReplay,
  resolveSectionHandler,
  listTrainedRoutines,
  getRoutineHeader,
  getRoutineSection,
  getRoutineStepSection,
  listRoutineStepSessions,
} from "@services/statistics.service";
import {
  decodeReplayCursor,
  encodeReplayCursor,
} from "@modules/stats/replay.module";
import { encodeDataVersion } from "@modules/stats/sections/series.module";
import type {
  DartZoneKey,
  ReplayParticipantRow,
  ReplayRow,
  ReplaySessionRow,
  ReplayStageRow,
} from "@modules/types";
import {
  SECTIONS,
  MAX_FOLD_DARTS,
  RESULT_DIRECTION,
  sectionsForGame,
} from "@lib/stats/section-registry";
import { SCORE_BANDS } from "@modules/stats/sections/scoring-trend.module";
import type { GameTypeKey } from "@lib/types";
import type { RoutineSectionQuery } from "@services/types";

const playerId = "0198f200-0000-7000-8000-000000000001";

const SEATS = [
  {
    participantRef: "participant-1",
    displayName: "Levi",
    sideKey: "HOME",
    participantTypeKey: "PLAYER",
  },
];

describe("getStatisticsOverview", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns all-zero/null stats when the player has no history", async () => {
    vi.mocked(repo.findSessionSummaries).mockResolvedValue([]);
    vi.mocked(repo.findVisitFacts).mockResolvedValue([]);
    vi.mocked(repo.findLegFacts).mockResolvedValue([]);
    vi.mocked(repo.findX01CheckoutDarts).mockResolvedValue([]);

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
      checkoutPercentage: null,
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
    vi.mocked(repo.findX01CheckoutDarts).mockResolvedValue([]);

    const result = await getStatisticsOverview(playerId);

    expect(result.totalGamesPlayed).toBe(1);
    expect(result.favoriteGameTypeKey).toBe("501");
    expect(result.oneEightiesCount).toBe(1);
    expect(result.bestLegDarts).toBe(9);
    expect(result.checkoutPercentage).toBeNull();
    expect(result.highestCheckout).toBeNull();
  });

  it("computes checkoutPercentage from a folded X01 checkout dart", async () => {
    vi.mocked(repo.findSessionSummaries).mockResolvedValue([]);
    vi.mocked(repo.findVisitFacts).mockResolvedValue([]);
    vi.mocked(repo.findLegFacts).mockResolvedValue([]);
    vi.mocked(repo.findX01CheckoutDarts).mockResolvedValue([
      {
        sessionId: "s1",
        gameTypeKey: "501",
        rulesetVersionKey: "501_V1",
        configuration: {
          starting_score: 40,
          legs_to_win: 1,
          check_in: "STRAIGHT_IN",
          check_out: "DOUBLE_OUT",
          max_darts_per_turn: 3,
          max_visit_score: 180,
          seats: SEATS,
        },
        stageId: "stage-1",
        stageSequence: 1,
        stageTypeKey: "LEG",
        parentStageId: null,
        turnId: "turn-1",
        turnSequence: 1,
        turnTotalScore: 40,
        turnCompletedAt: "2026-09-01T10:00:00.000Z",
        participantId: "participant-1",
        dartNumber: 1,
        hitTargetNumber: 20,
        hitZoneKey: "DOUBLE",
        score: 40,
      },
    ]);

    const result = await getStatisticsOverview(playerId);

    expect(result.checkoutPercentage).toBe(1);
    expect(result.highestCheckout).toEqual({
      value: 40,
      timesHit: 1,
      sessionId: "s1",
    });
  });

  /**
   * One career fold spanning all three X01 ladders in a single fixture:
   * a 501 leg whose first visit busts (real dart score 60, recorded total 0)
   * before the second visit checks out the SAME remaining on a double, a
   * TUOD attempt that checks out its starting target directly, and a 121
   * attempt whose first visit misses a reachable remaining (an explicit
   * board MISS) before its second visit checks it out.
   *
   * Hand-computed attempts, walking `classifyDart` visit by visit:
   *   501:  visit 1 (remaining 40, T20 for 60)  -> bust  -> MISS
   *         visit 2 (remaining 40, D20 for 40)  -> exact -> HIT
   *   TUOD: visit 1 (target 40, D20 for 40)     -> exact -> HIT
   *   121:  visit 1, dart 3 (remaining 22 after T19+T14, board MISS) -> MISS
   *         visit 2 (remaining 22, D11 for 22)  -> exact -> HIT
   * hits = 3 (501 visit 2, TUOD visit 1, 121 visit 2)
   * misses = 2 (501 visit 1, 121 visit 1 dart 3)
   * checkoutPercentage = 3 / (3 + 2) = 0.6
   */
  it("folds career checkoutPercentage across 501, TUOD and 121 in one pass", async () => {
    vi.mocked(repo.findSessionSummaries).mockResolvedValue([]);
    vi.mocked(repo.findVisitFacts).mockResolvedValue([]);
    vi.mocked(repo.findLegFacts).mockResolvedValue([]);
    vi.mocked(repo.findX01CheckoutDarts).mockResolvedValue([
      {
        sessionId: "s-501",
        gameTypeKey: "501",
        rulesetVersionKey: "501_V1",
        configuration: {
          starting_score: 40,
          legs_to_win: 1,
          check_in: "STRAIGHT_IN",
          check_out: "DOUBLE_OUT",
          max_darts_per_turn: 3,
          max_visit_score: 180,
          seats: SEATS,
        },
        stageId: "leg-1",
        stageSequence: 1,
        stageTypeKey: "LEG",
        parentStageId: null,
        turnId: "t1",
        turnSequence: 1,
        turnTotalScore: 0,
        turnCompletedAt: "2026-09-19T10:00:00.000Z",
        participantId: "participant-1",
        dartNumber: 1,
        hitTargetNumber: 20,
        hitZoneKey: "TREBLE",
        score: 60,
      },
      {
        sessionId: "s-501",
        gameTypeKey: "501",
        rulesetVersionKey: "501_V1",
        configuration: {
          starting_score: 40,
          legs_to_win: 1,
          check_in: "STRAIGHT_IN",
          check_out: "DOUBLE_OUT",
          max_darts_per_turn: 3,
          max_visit_score: 180,
          seats: SEATS,
        },
        stageId: "leg-1",
        stageSequence: 1,
        stageTypeKey: "LEG",
        parentStageId: null,
        turnId: "t2",
        turnSequence: 2,
        turnTotalScore: 40,
        turnCompletedAt: "2026-09-19T10:01:00.000Z",
        participantId: "participant-1",
        dartNumber: 1,
        hitTargetNumber: 20,
        hitZoneKey: "DOUBLE",
        score: 40,
      },
      {
        sessionId: "s-tuod",
        gameTypeKey: "TUOD",
        rulesetVersionKey: "TUOD_V1",
        configuration: {
          starting_target: 40,
          finish_bonus: 10,
          miss_penalty: 10,
          duration_type: "ROUNDS",
          duration_value: 5,
          max_darts_per_turn: 3,
          seats: SEATS,
        },
        stageId: "block-1",
        stageSequence: 1,
        stageTypeKey: "EXERCISE_BLOCK",
        parentStageId: null,
        turnId: "u1",
        turnSequence: 1,
        turnTotalScore: 40,
        turnCompletedAt: "2026-09-19T10:02:00.000Z",
        participantId: "participant-1",
        dartNumber: 1,
        hitTargetNumber: 20,
        hitZoneKey: "DOUBLE",
        score: 40,
      },
      {
        sessionId: "s-121",
        gameTypeKey: "ONE_TWENTY_ONE",
        rulesetVersionKey: "121_V1",
        configuration: { seats: SEATS },
        stageId: "round-1",
        stageSequence: 1,
        stageTypeKey: "ROUND",
        parentStageId: null,
        turnId: "v1",
        turnSequence: 1,
        turnTotalScore: 99,
        turnCompletedAt: "2026-09-19T10:03:00.000Z",
        participantId: "participant-1",
        dartNumber: 1,
        hitTargetNumber: 19,
        hitZoneKey: "TREBLE",
        score: 57,
      },
      {
        sessionId: "s-121",
        gameTypeKey: "ONE_TWENTY_ONE",
        rulesetVersionKey: "121_V1",
        configuration: { seats: SEATS },
        stageId: "round-1",
        stageSequence: 1,
        stageTypeKey: "ROUND",
        parentStageId: null,
        turnId: "v1",
        turnSequence: 1,
        turnTotalScore: 99,
        turnCompletedAt: "2026-09-19T10:03:00.000Z",
        participantId: "participant-1",
        dartNumber: 2,
        hitTargetNumber: 14,
        hitZoneKey: "TREBLE",
        score: 42,
      },
      {
        sessionId: "s-121",
        gameTypeKey: "ONE_TWENTY_ONE",
        rulesetVersionKey: "121_V1",
        configuration: { seats: SEATS },
        stageId: "round-1",
        stageSequence: 1,
        stageTypeKey: "ROUND",
        parentStageId: null,
        turnId: "v1",
        turnSequence: 1,
        turnTotalScore: 99,
        turnCompletedAt: "2026-09-19T10:03:00.000Z",
        participantId: "participant-1",
        dartNumber: 3,
        hitTargetNumber: null,
        hitZoneKey: "MISS",
        score: 0,
      },
      {
        sessionId: "s-121",
        gameTypeKey: "ONE_TWENTY_ONE",
        rulesetVersionKey: "121_V1",
        configuration: { seats: SEATS },
        stageId: "round-1",
        stageSequence: 1,
        stageTypeKey: "ROUND",
        parentStageId: null,
        turnId: "v2",
        turnSequence: 2,
        turnTotalScore: 22,
        turnCompletedAt: "2026-09-19T10:04:00.000Z",
        participantId: "participant-1",
        dartNumber: 1,
        hitTargetNumber: 11,
        hitZoneKey: "DOUBLE",
        score: 22,
      },
    ]);

    const result = await getStatisticsOverview(playerId);

    expect(result.checkoutPercentage).toBe(0.6);
  });

  /**
   * Every ruleset config schema is `.strict()` with required fields, so a
   * historical session whose stored snapshot has since drifted makes the
   * codec throw. The whole overview is assembled in one pass, so that throw
   * used to 500 `/api/statistics/overview` outright -- every card on
   * `/statistics`, not just Checkout %. The drifted session now contributes
   * nothing and the rest of the batch still folds.
   */
  it("skips a session whose stored configuration no longer validates instead of failing the overview", async () => {
    vi.mocked(repo.findSessionSummaries).mockResolvedValue([]);
    vi.mocked(repo.findVisitFacts).mockResolvedValue([]);
    vi.mocked(repo.findLegFacts).mockResolvedValue([]);
    vi.mocked(repo.findX01CheckoutDarts).mockResolvedValue([
      {
        sessionId: "s-drifted",
        gameTypeKey: "501",
        rulesetVersionKey: "501_V1",
        configuration: { starting_score: 501, seats: SEATS },
        stageId: "stage-drifted",
        stageSequence: 1,
        stageTypeKey: "LEG",
        parentStageId: null,
        turnId: "turn-drifted",
        turnSequence: 1,
        turnTotalScore: 40,
        turnCompletedAt: "2026-09-01T10:00:00.000Z",
        participantId: "participant-1",
        dartNumber: 1,
        hitTargetNumber: 20,
        hitZoneKey: "DOUBLE",
        score: 40,
      },
      {
        sessionId: "s-good",
        gameTypeKey: "501",
        rulesetVersionKey: "501_V1",
        configuration: {
          starting_score: 40,
          legs_to_win: 1,
          check_in: "STRAIGHT_IN",
          check_out: "DOUBLE_OUT",
          max_darts_per_turn: 3,
          max_visit_score: 180,
          seats: SEATS,
        },
        stageId: "stage-good",
        stageSequence: 1,
        stageTypeKey: "LEG",
        parentStageId: null,
        turnId: "turn-good",
        turnSequence: 1,
        turnTotalScore: 40,
        turnCompletedAt: "2026-09-01T10:00:00.000Z",
        participantId: "participant-1",
        dartNumber: 1,
        hitTargetNumber: 20,
        hitZoneKey: "DOUBLE",
        score: 40,
      },
    ]);

    const result = await getStatisticsOverview(playerId);

    expect(result.checkoutPercentage).toBe(1);
    expect(result.highestCheckout).toEqual({
      value: 40,
      timesHit: 1,
      sessionId: "s-good",
    });
  });
});

const baseRangeQuery = {
  from: "2026-01-01T00:00:00.000Z",
  to: "2026-02-01T00:00:00.000Z",
  tz: undefined,
  bucket: "none" as const,
  status: undefined,
  context: "all" as const,
  inputMode: "VISUAL_BOARD" as const,
};

function makeSessionRow(overrides: Record<string, unknown>) {
  return {
    sessionId: "s1",
    rulesetVersionKey: "501_V1",
    statusKey: "COMPLETED",
    contextKey: "STANDALONE",
    neverStarted: false,
    startedAt: "2026-01-01T00:00:00.000Z",
    completedAt: "2026-01-01T00:05:00.000Z",
    durationSeconds: 300,
    turnCount: 10,
    dartCount: 30,
    countedScore: 501,
    ...overrides,
  };
}

describe("listGameSessions", () => {
  beforeEach(() => vi.clearAllMocks());

  it("sets nextCursor when a further page exists (limit + 1 rows)", async () => {
    vi.mocked(repo.findGameSessionsPage).mockResolvedValue([
      makeSessionRow({
        sessionId: "s1",
        completedAt: "2026-01-03T00:00:00.000Z",
      }),
      makeSessionRow({
        sessionId: "s2",
        completedAt: "2026-01-02T00:00:00.000Z",
      }),
    ]);
    vi.mocked(repo.findGameDataVersion).mockResolvedValue({
      count: 2,
      maxCompletedAt: "2026-01-03T00:00:00.000Z",
    });

    const result = await listGameSessions(playerId, "501", {
      ...baseRangeQuery,
      status: "all",
      limit: 1,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.items).toHaveLength(1);
      expect(result.data.nextCursor).not.toBeNull();
    }
  });

  it("returns nextCursor null when exactly limit rows come back", async () => {
    vi.mocked(repo.findGameSessionsPage).mockResolvedValue([
      makeSessionRow({}),
    ]);
    vi.mocked(repo.findGameDataVersion).mockResolvedValue({
      count: 1,
      maxCompletedAt: "2026-01-01T00:00:00.000Z",
    });

    const result = await listGameSessions(playerId, "501", {
      ...baseRangeQuery,
      status: "all",
      limit: 1,
    });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.nextCursor).toBeNull();
  });

  it("rejects a malformed cursor", async () => {
    const result = await listGameSessions(playerId, "501", {
      ...baseRangeQuery,
      status: "all",
      limit: 25,
      cursor: "%%%",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("VALIDATION_FAILED");
    expect(repo.findGameSessionsPage).not.toHaveBeenCalled();
  });
});

describe("getGameSection", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rejects a status the section does not accept", async () => {
    const result = await getGameSection(playerId, "501", "volume", {
      ...baseRangeQuery,
      status: "abandoned",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("VALIDATION_FAILED");
  });

  it("rejects a status other than all on the includesAbandoned section", async () => {
    const result = await getGameSection(playerId, "501", "completion", {
      ...baseRangeQuery,
      status: "completed",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("VALIDATION_FAILED");
  });

  it("returns NOT_FOUND for a section outside the game's registry", async () => {
    const result = await getGameSection(
      playerId,
      "501",
      "target-accuracy",
      baseRangeQuery,
    );

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("NOT_FOUND");
  });

  it("rejects bucket != none on a non-bucketable section", async () => {
    const original = SECTIONS.volume.bucketable;
    (SECTIONS.volume as { bucketable: boolean }).bucketable = false;
    try {
      const result = await getGameSection(playerId, "501", "volume", {
        ...baseRangeQuery,
        bucket: "month",
        tz: "Europe/Amsterdam",
        status: "completed",
      });

      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.code).toBe("VALIDATION_FAILED");
    } finally {
      (SECTIONS.volume as { bucketable: boolean }).bucketable = original;
    }
  });

  it("returns a completion series on the happy path without flooring", async () => {
    vi.mocked(repo.findGameDataVersion).mockResolvedValue({
      count: 3,
      maxCompletedAt: "2026-01-15T00:00:00.000Z",
    });
    vi.mocked(repo.findBucketedSessionAggregates).mockResolvedValue([
      {
        bucketStart: "2026-01-01T00:00:00.000Z",
        bucketEnd: "2026-02-01T00:00:00.000Z",
        statusKey: "COMPLETED",
        contextKey: "STANDALONE",
        rulesetVersionKey: "501_V1",
        neverStarted: false,
        sessions: 3,
        turnSum: 30,
        dartSum: 90,
        durationSum: 900,
        scoreSum: 1500,
        scoreMin: 400,
        scoreMax: 600,
        minSessionId: "s1",
        maxSessionId: "s2",
        bestAvgSessionId: "s2",
        bestAvgPoints: 600,
        bestAvgDarts: 30,
        bestAvgCompletedAt: "2026-01-15T10:00:00.000Z",
      },
    ]);

    const result = await getGameSection(playerId, "501", "completion", {
      ...baseRangeQuery,
      status: "all",
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.sectionId).toBe("completion");
      expect(result.data.buckets).toHaveLength(1);
    }
    expect(repo.findBucketFloor).not.toHaveBeenCalled();
  });

  it("floors from to the bucket start when bucketed, and echoes it in range", async () => {
    vi.mocked(repo.findBucketFloor).mockResolvedValue(
      "2026-01-01T00:00:00.000Z",
    );
    vi.mocked(repo.findGameDataVersion).mockResolvedValue({
      count: 0,
      maxCompletedAt: null,
    });
    vi.mocked(repo.findBucketedSessionAggregates).mockResolvedValue([]);

    const result = await getGameSection(playerId, "501", "volume", {
      ...baseRangeQuery,
      from: "2026-01-15T00:00:00.000Z",
      bucket: "month",
      tz: "Europe/Amsterdam",
      status: "completed",
    });

    expect(repo.findBucketFloor).toHaveBeenCalledWith(
      expect.anything(),
      "2026-01-15T00:00:00.000Z",
      "month",
      "Europe/Amsterdam",
    );
    expect(result.ok).toBe(true);
    if (result.ok)
      expect(result.data.range.from).toBe("2026-01-01T00:00:00.000Z");
  });

  it("dispatches target-accuracy through findIntentCells", async () => {
    vi.mocked(repo.findGameDataVersion).mockResolvedValue({
      count: 1,
      maxCompletedAt: "2026-01-15T00:00:00.000Z",
    });
    vi.mocked(repo.findIntentCells).mockResolvedValue([
      {
        bucketStart: baseRangeQuery.from,
        bucketEnd: baseRangeQuery.to,
        intendedTargetNumber: 16,
        intendedZoneKey: "DOUBLE",
        hitTargetNumber: 16,
        hitZoneKey: "DOUBLE",
        darts: 5,
      },
    ]);

    const result = await getGameSection(
      playerId,
      "DOUBLES_TRAINING",
      "target-accuracy",
      { ...baseRangeQuery, status: "completed" },
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.sectionId).toBe("target-accuracy");
      expect(result.data.buckets[0].metrics).toEqual({
        "DOUBLE:16": { attempts: 5, hits: 5 },
      });
    }
  });

  it("dispatches confusion through findIntentCells", async () => {
    vi.mocked(repo.findGameDataVersion).mockResolvedValue({
      count: 1,
      maxCompletedAt: null,
    });
    vi.mocked(repo.findIntentCells).mockResolvedValue([
      {
        bucketStart: baseRangeQuery.from,
        bucketEnd: baseRangeQuery.to,
        intendedTargetNumber: 16,
        intendedZoneKey: "DOUBLE",
        hitTargetNumber: 16,
        hitZoneKey: "DOUBLE",
        darts: 5,
      },
    ]);

    const result = await getGameSection(
      playerId,
      "DOUBLES_TRAINING",
      "confusion",
      { ...baseRangeQuery, status: "completed" },
    );

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.sectionId).toBe("confusion");
  });

  it("dispatches loose-darts through findIntentCells", async () => {
    vi.mocked(repo.findGameDataVersion).mockResolvedValue({
      count: 1,
      maxCompletedAt: null,
    });
    vi.mocked(repo.findIntentCells).mockResolvedValue([
      {
        bucketStart: baseRangeQuery.from,
        bucketEnd: baseRangeQuery.to,
        intendedTargetNumber: 16,
        intendedZoneKey: "DOUBLE",
        hitTargetNumber: 16,
        hitZoneKey: "DOUBLE",
        darts: 5,
      },
    ]);

    const result = await getGameSection(
      playerId,
      "DOUBLES_TRAINING",
      "loose-darts",
      { ...baseRangeQuery, status: "completed" },
    );

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.sectionId).toBe("loose-darts");
  });

  it("dispatches grouping through findIntentMoments", async () => {
    vi.mocked(repo.findGameDataVersion).mockResolvedValue({
      count: 1,
      maxCompletedAt: null,
    });
    vi.mocked(repo.findIntentMoments).mockResolvedValue([
      {
        bucketStart: baseRangeQuery.from,
        bucketEnd: baseRangeQuery.to,
        intendedTargetNumber: 16,
        intendedZoneKey: "DOUBLE",
        n: 2,
        sumX: 1,
        sumY: 1,
        sumXX: 1,
        sumYY: 1,
        sumXY: 1,
      },
    ]);

    const result = await getGameSection(
      playerId,
      "DOUBLES_TRAINING",
      "grouping",
      { ...baseRangeQuery, status: "completed" },
    );

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.sectionId).toBe("grouping");
    expect(repo.findIntentMoments).toHaveBeenCalled();
  });

  it("dispatches miss-direction through findMissSectors with reference points", async () => {
    vi.mocked(repo.findGameDataVersion).mockResolvedValue({
      count: 1,
      maxCompletedAt: null,
    });
    vi.mocked(repo.findMissSectors).mockResolvedValue([
      {
        targetNumber: 16,
        zoneKey: "DOUBLE",
        sector: 0,
        radial: "WITHIN",
        darts: 3,
      },
    ]);

    const result = await getGameSection(
      playerId,
      "DOUBLES_TRAINING",
      "miss-direction",
      { ...baseRangeQuery, status: "completed" },
    );

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.sectionId).toBe("miss-direction");
    const call = vi.mocked(repo.findMissSectors).mock.calls[0]![1] as {
      refs: unknown[];
    };
    expect(call.refs.length).toBe(82);
  });

  it("dispatches heatmap through findHeatmapCells", async () => {
    vi.mocked(repo.findGameDataVersion).mockResolvedValue({
      count: 1,
      maxCompletedAt: null,
    });
    vi.mocked(repo.findHeatmapCells).mockResolvedValue([
      { ix: 0, iy: 0, darts: 4 },
    ]);

    const result = await getGameSection(playerId, "501", "heatmap", {
      ...baseRangeQuery,
      status: "completed",
    });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.sectionId).toBe("heatmap");
  });

  it("passes the parsed target to findHeatmapCells on an intent-stored game", async () => {
    vi.mocked(repo.findGameDataVersion).mockResolvedValue({
      count: 1,
      maxCompletedAt: null,
    });
    vi.mocked(repo.findHeatmapCells).mockResolvedValue([]);

    await getGameSection(playerId, "DOUBLES_TRAINING", "heatmap", {
      ...baseRangeQuery,
      status: "completed",
      target: "DOUBLE:16",
    });

    const call = vi.mocked(repo.findHeatmapCells).mock.calls[0]![1] as {
      target: { number: number; zone: string } | null;
    };
    expect(call.target).toEqual({ number: 16, zone: "DOUBLE" });
  });

  it("rejects a target on a game without intent-stored", async () => {
    const result = await getGameSection(playerId, "501", "heatmap", {
      ...baseRangeQuery,
      status: "completed",
      target: "DOUBLE:16",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("VALIDATION_FAILED");
      expect(result.details?.reason).toContain("target");
    }
  });

  it("rejects a target on a section that does not declare the target param", async () => {
    const result = await getGameSection(
      playerId,
      "DOUBLES_TRAINING",
      "grouping",
      { ...baseRangeQuery, status: "completed", target: "DOUBLE:16" },
    );

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("VALIDATION_FAILED");
  });

  it("rejects bucket=month on the non-bucketable confusion section", async () => {
    const result = await getGameSection(
      playerId,
      "DOUBLES_TRAINING",
      "confusion",
      {
        ...baseRangeQuery,
        bucket: "month",
        tz: "Europe/Amsterdam",
        status: "completed",
      },
    );

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("VALIDATION_FAILED");
  });

  it("returns NOT_FOUND for grouping on Singles Training (phase-4 decision 6: no aim point for a whole-number aim)", async () => {
    const result = await getGameSection(
      playerId,
      "SINGLES_TRAINING",
      "grouping",
      { ...baseRangeQuery, status: "completed" },
    );

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("NOT_FOUND");
  });
});

const FOLD_501_CONFIG = {
  starting_score: 40,
  legs_to_win: 1,
  check_in: "STRAIGHT_IN",
  check_out: "DOUBLE_OUT",
  max_darts_per_turn: 3,
  max_visit_score: 180,
  seats: SEATS,
};

const FOLD_TUOD_CONFIG = {
  starting_target: 40,
  finish_bonus: 10,
  miss_penalty: 10,
  duration_type: "ROUNDS",
  duration_value: 5,
  max_darts_per_turn: 3,
  seats: SEATS,
};

/** A single X01 fold row: a 501 leg's lone visit, a straight double-20 checkout of 40. */
function makeFoldRow(overrides: Record<string, unknown> = {}) {
  return {
    sessionId: "s1",
    gameTypeKey: "501",
    rulesetVersionKey: "501_V1",
    configuration: FOLD_501_CONFIG,
    stageId: "stage-1",
    stageSequence: 1,
    stageTypeKey: "LEG",
    parentStageId: null,
    turnId: "turn-1",
    turnSequence: 1,
    turnTotalScore: 40,
    turnCompletedAt: "2026-09-01T10:00:00.000Z",
    participantId: "participant-1",
    dartNumber: 1,
    hitTargetNumber: 20,
    hitZoneKey: "DOUBLE",
    score: 40,
    bucketStart: "2026-01-01T00:00:00.000Z",
    bucketEnd: "2026-02-01T00:00:00.000Z",
    ...overrides,
  };
}

/** A single X01 fold row: a TUOD exercise block's lone visit, checking out target 40. */
function makeTuodFoldRow(overrides: Record<string, unknown> = {}) {
  return {
    sessionId: "s-tuod",
    gameTypeKey: "TUOD",
    rulesetVersionKey: "TUOD_V1",
    configuration: FOLD_TUOD_CONFIG,
    stageId: "block-1",
    stageSequence: 1,
    stageTypeKey: "EXERCISE_BLOCK",
    parentStageId: null,
    turnId: "turn-1",
    turnSequence: 1,
    turnTotalScore: 40,
    turnCompletedAt: "2026-09-01T10:00:00.000Z",
    participantId: "participant-1",
    dartNumber: 1,
    hitTargetNumber: 20,
    hitZoneKey: "DOUBLE",
    score: 40,
    bucketStart: "2026-01-01T00:00:00.000Z",
    bucketEnd: "2026-02-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("getGameSection dispatches the checkout family", () => {
  beforeEach(() => vi.clearAllMocks());

  it("dispatches checkout-rate through the fold", async () => {
    vi.mocked(repo.findGameDataVersion).mockResolvedValue({
      count: 1,
      maxCompletedAt: null,
    });
    vi.mocked(repo.findScopeDartCount).mockResolvedValue(1);
    vi.mocked(repo.findX01FoldRows).mockResolvedValue([makeFoldRow()] as never);

    const result = await getGameSection(playerId, "501", "checkout-rate", {
      ...baseRangeQuery,
      status: "completed",
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.sectionId).toBe("checkout-rate");
      expect(result.data.buckets[0]!.metrics).toEqual({
        "40": { chances: 1, finished: 1 },
      });
    }
    expect(repo.findScopeDartCount).toHaveBeenCalled();
    expect(repo.findX01FoldRows).toHaveBeenCalled();
  });

  it("dispatches double-performance through the fold", async () => {
    vi.mocked(repo.findGameDataVersion).mockResolvedValue({
      count: 1,
      maxCompletedAt: null,
    });
    vi.mocked(repo.findScopeDartCount).mockResolvedValue(1);
    vi.mocked(repo.findX01FoldRows).mockResolvedValue([makeFoldRow()] as never);

    const result = await getGameSection(playerId, "501", "double-performance", {
      ...baseRangeQuery,
      status: "completed",
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.sectionId).toBe("double-performance");
      expect(result.data.buckets[0]!.metrics).toEqual({
        "DOUBLE:20": { attempts: 1, hits: 1 },
      });
    }
  });

  it("dispatches checkout-path through the fold", async () => {
    vi.mocked(repo.findGameDataVersion).mockResolvedValue({
      count: 1,
      maxCompletedAt: null,
    });
    vi.mocked(repo.findScopeDartCount).mockResolvedValue(1);
    vi.mocked(repo.findX01FoldRows).mockResolvedValue([makeFoldRow()] as never);

    const result = await getGameSection(playerId, "501", "checkout-path", {
      ...baseRangeQuery,
      status: "completed",
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.sectionId).toBe("checkout-path");
      expect(result.data.buckets[0]!.metrics).toEqual({
        "40": { D20: { visits: 1, finished: 1 } },
      });
    }
  });

  it("dispatches bust-rate through the fold", async () => {
    vi.mocked(repo.findGameDataVersion).mockResolvedValue({
      count: 1,
      maxCompletedAt: null,
    });
    vi.mocked(repo.findScopeDartCount).mockResolvedValue(1);
    vi.mocked(repo.findX01FoldRows).mockResolvedValue([makeFoldRow()] as never);

    const result = await getGameSection(playerId, "501", "bust-rate", {
      ...baseRangeQuery,
      status: "completed",
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.sectionId).toBe("bust-rate");
      expect(result.data.buckets[0]!.metrics).toEqual({
        "40": { visits: 1, busts: 0 },
      });
    }
  });

  it("dispatches leg-stats through the fold", async () => {
    vi.mocked(repo.findGameDataVersion).mockResolvedValue({
      count: 1,
      maxCompletedAt: null,
    });
    vi.mocked(repo.findScopeDartCount).mockResolvedValue(1);
    vi.mocked(repo.findX01FoldRows).mockResolvedValue([makeFoldRow()] as never);

    const result = await getGameSection(playerId, "501", "leg-stats", {
      ...baseRangeQuery,
      status: "completed",
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.sectionId).toBe("leg-stats");
      expect(result.data.buckets[0]!.metrics).toEqual({
        legs: { "1": 1 },
        bestLeg: { darts: 1, sessionId: expect.any(String) },
      });
    }
  });

  it("dispatches ladder-progress through the fold on TUOD", async () => {
    vi.mocked(repo.findGameDataVersion).mockResolvedValue({
      count: 1,
      maxCompletedAt: null,
    });
    vi.mocked(repo.findScopeDartCount).mockResolvedValue(1);
    vi.mocked(repo.findX01FoldRows).mockResolvedValue([
      makeTuodFoldRow(),
    ] as never);

    const result = await getGameSection(playerId, "TUOD", "ladder-progress", {
      ...baseRangeQuery,
      status: "completed",
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.sectionId).toBe("ladder-progress");
      expect(result.data.buckets[0]!.metrics).toEqual({
        targets: { "40": { attempts: 1, successes: 1 } },
        maxTarget: 40,
        afterMiss: 0,
        recovered: 0,
      });
    }
  });

  it("dispatches scoring-trend through findVisitScoring with SCORE_BANDS", async () => {
    vi.mocked(repo.findGameDataVersion).mockResolvedValue({
      count: 1,
      maxCompletedAt: null,
    });
    vi.mocked(repo.findVisitScoring).mockResolvedValue([
      {
        bucketStart: baseRangeQuery.from,
        bucketEnd: baseRangeQuery.to,
        points: 180,
        darts: 3,
        firstNinePoints: 180,
        firstNineDarts: 3,
        ton: 0,
        tonForty: 0,
        oneEighty: 1,
      },
    ]);

    const result = await getGameSection(playerId, "501", "scoring-trend", {
      ...baseRangeQuery,
      status: "completed",
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.sectionId).toBe("scoring-trend");
      expect(result.data.buckets[0]!.metrics).toEqual({
        points: 180,
        darts: 3,
        firstNinePoints: 180,
        firstNineDarts: 3,
        bands: { ton: 0, tonForty: 0, oneEighty: 1 },
      });
    }
    expect(repo.findScopeDartCount).not.toHaveBeenCalled();
    const call = vi.mocked(repo.findVisitScoring).mock.calls[0]![1] as {
      bands: unknown;
    };
    expect(call.bands).toEqual(SCORE_BANDS);
  });

  it("dispatches treble-rate through findHitNumberCells", async () => {
    vi.mocked(repo.findGameDataVersion).mockResolvedValue({
      count: 1,
      maxCompletedAt: null,
    });
    vi.mocked(repo.findHitNumberCells).mockResolvedValue([
      {
        bucketStart: baseRangeQuery.from,
        bucketEnd: baseRangeQuery.to,
        hitNumber: "20",
        darts: 4,
        trebles: 2,
      },
    ]);

    const result = await getGameSection(playerId, "501", "treble-rate", {
      ...baseRangeQuery,
      status: "completed",
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.sectionId).toBe("treble-rate");
      expect(result.data.buckets[0]!.metrics).toEqual({
        "20": { darts: 4, trebles: 2 },
      });
    }
    expect(repo.findScopeDartCount).not.toHaveBeenCalled();
  });

  it("returns VALIDATION_FAILED above MAX_FOLD_DARTS and never calls findX01FoldRows", async () => {
    vi.mocked(repo.findGameDataVersion).mockResolvedValue({
      count: 1,
      maxCompletedAt: null,
    });
    const dartCount = MAX_FOLD_DARTS + 1;
    vi.mocked(repo.findScopeDartCount).mockResolvedValue(dartCount);

    const result = await getGameSection(playerId, "501", "checkout-rate", {
      ...baseRangeQuery,
      status: "completed",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("VALIDATION_FAILED");
      expect(result.details?.reason).toBe(
        `range holds ${dartCount} darts; server sections fold at most ${MAX_FOLD_DARTS} — request a shorter range`,
      );
    }
    expect(repo.findX01FoldRows).not.toHaveBeenCalled();
  });

  it("returns NOT_FOUND for ladder-progress on 501", async () => {
    const result = await getGameSection(playerId, "501", "ladder-progress", {
      ...baseRangeQuery,
      status: "completed",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("NOT_FOUND");
    expect(repo.findScopeDartCount).not.toHaveBeenCalled();
  });

  it("returns NOT_FOUND for leg-stats on TUOD", async () => {
    const result = await getGameSection(playerId, "TUOD", "leg-stats", {
      ...baseRangeQuery,
      status: "completed",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("NOT_FOUND");
  });

  it("rejects bucket=month on checkout-path (not bucketable)", async () => {
    const result = await getGameSection(playerId, "501", "checkout-path", {
      ...baseRangeQuery,
      bucket: "month",
      tz: "Europe/Amsterdam",
      status: "completed",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("VALIDATION_FAILED");
    expect(repo.findScopeDartCount).not.toHaveBeenCalled();
  });
});

/** One `findDartFoldRows` row for a Shanghai session: one dart at the first target, number 1. */
function makeShanghaiFoldRow(overrides: Record<string, unknown> = {}) {
  return {
    sessionId: "s-shanghai",
    gameTypeKey: "SHANGHAI",
    rulesetVersionKey: "SHANGHAI_V1",
    configuration: { seats: SEATS },
    sessionDartCount: 1,
    bucketStart: "2026-01-01T00:00:00.000Z",
    bucketEnd: "2026-02-01T00:00:00.000Z",
    turnSequence: 1,
    dartNumber: 1,
    hitTargetNumber: 1,
    hitZoneKey: "OUTER_SINGLE",
    intendedTargetNumber: null,
    intendedZoneKey: null,
    locationX: 0,
    locationY: 0,
    ...overrides,
  };
}

/** One `findDartFoldRows` row for an Around the Clock V1 session: one dart at the first target, number 1. */
function makeAtcFoldRow(overrides: Record<string, unknown> = {}) {
  return {
    sessionId: "s-atc",
    gameTypeKey: "AROUND_THE_CLOCK",
    rulesetVersionKey: "AROUND_THE_CLOCK_V1",
    configuration: {},
    sessionDartCount: 1,
    bucketStart: "2026-01-01T00:00:00.000Z",
    bucketEnd: "2026-02-01T00:00:00.000Z",
    turnSequence: 1,
    dartNumber: 1,
    hitTargetNumber: 1,
    hitZoneKey: "OUTER_SINGLE",
    intendedTargetNumber: null,
    intendedZoneKey: null,
    locationX: 0,
    locationY: 0,
    ...overrides,
  };
}

/**
 * A Bob's 27 visit resolves on its 3rd dart (`applyBobs27Dart`): one made D1
 * followed by two misses reaches D1 and advances.
 */
function makeBobs27FoldRows(): unknown[] {
  const config = {
    start_score: 27,
    bull_hit_value: 50,
    miss_penalty_multiplier: 1,
    seats: SEATS,
  };
  const darts = [
    { hitTargetNumber: 1, hitZoneKey: "DOUBLE" },
    { hitTargetNumber: null, hitZoneKey: "MISS" },
    { hitTargetNumber: null, hitZoneKey: "MISS" },
  ];
  return darts.map((dart, index) => ({
    sessionId: "s-bobs27",
    gameTypeKey: "BOBS27",
    rulesetVersionKey: "BOBS27_V1",
    configuration: config,
    sessionDartCount: darts.length,
    bucketStart: "2026-01-01T00:00:00.000Z",
    bucketEnd: "2026-02-01T00:00:00.000Z",
    turnSequence: 1,
    dartNumber: index + 1,
    intendedTargetNumber: null,
    intendedZoneKey: null,
    locationX: 0,
    locationY: 0,
    ...dart,
  }));
}

describe("getGameSection dispatches derived-intent and game-specific sections (phase-4 Task 8)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("resolves a handler for every section each game's own page offers", () => {
    for (const gameTypeKey of Object.keys(RESULT_DIRECTION) as GameTypeKey[]) {
      for (const sectionId of sectionsForGame(gameTypeKey)) {
        expect(resolveSectionHandler(sectionId, gameTypeKey)).toBeDefined();
      }
    }
  });

  it("dispatches target-accuracy through findIntentCells on DOUBLES_TRAINING (sql site)", async () => {
    vi.mocked(repo.findGameDataVersion).mockResolvedValue({
      count: 1,
      maxCompletedAt: null,
    });
    vi.mocked(repo.findIntentCells).mockResolvedValue([
      {
        bucketStart: baseRangeQuery.from,
        bucketEnd: baseRangeQuery.to,
        intendedTargetNumber: 16,
        intendedZoneKey: "DOUBLE",
        hitTargetNumber: 16,
        hitZoneKey: "DOUBLE",
        darts: 5,
      },
    ]);

    const result = await getGameSection(
      playerId,
      "DOUBLES_TRAINING",
      "target-accuracy",
      { ...baseRangeQuery, status: "completed" },
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(
        (result.data as { skippedSessions?: number }).skippedSessions,
      ).toBeUndefined();
    }
    expect(repo.findIntentCells).toHaveBeenCalled();
    expect(repo.findDartFoldRows).not.toHaveBeenCalled();
  });

  it("dispatches target-accuracy through findDartFoldRows on SHANGHAI (server site, decision 5)", async () => {
    vi.mocked(repo.findGameDataVersion).mockResolvedValue({
      count: 1,
      maxCompletedAt: null,
    });
    vi.mocked(repo.findScopeDartCount).mockResolvedValue(1);
    vi.mocked(repo.findDartFoldRows).mockResolvedValue([
      makeShanghaiFoldRow(),
    ] as never);

    const result = await getGameSection(
      playerId,
      "SHANGHAI",
      "target-accuracy",
      { ...baseRangeQuery, status: "completed" },
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.sectionId).toBe("target-accuracy");
      expect(result.data.buckets[0]!.metrics).toEqual({
        "NUMBER:1": { attempts: 1, hits: 1 },
      });
      expect(
        (result.data as { skippedSessions?: number }).skippedSessions,
      ).toBe(0);
    }
    expect(repo.findDartFoldRows).toHaveBeenCalled();
    expect(repo.findIntentCells).not.toHaveBeenCalled();
  });

  it("dispatches miss-direction through findDartFoldRows on AROUND_THE_CLOCK (server site, decision 7)", async () => {
    vi.mocked(repo.findGameDataVersion).mockResolvedValue({
      count: 1,
      maxCompletedAt: null,
    });
    vi.mocked(repo.findScopeDartCount).mockResolvedValue(1);
    vi.mocked(repo.findDartFoldRows).mockResolvedValue([
      makeAtcFoldRow({ hitTargetNumber: null, hitZoneKey: "MISS" }),
    ] as never);

    const result = await getGameSection(
      playerId,
      "AROUND_THE_CLOCK",
      "miss-direction",
      { ...baseRangeQuery, status: "completed" },
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.sectionId).toBe("miss-direction");
      expect(Object.keys(result.data.buckets[0]!.metrics)).toEqual([
        "NUMBER:1",
      ]);
    }
    expect(repo.findDartFoldRows).toHaveBeenCalled();
    expect(repo.findMissSectors).not.toHaveBeenCalled();
  });

  it("returns VALIDATION_FAILED above MAX_FOLD_DARTS on atc-darts-per-target and never calls findDartFoldRows", async () => {
    vi.mocked(repo.findGameDataVersion).mockResolvedValue({
      count: 1,
      maxCompletedAt: null,
    });
    const dartCount = MAX_FOLD_DARTS + 1;
    vi.mocked(repo.findScopeDartCount).mockResolvedValue(dartCount);

    const result = await getGameSection(
      playerId,
      "AROUND_THE_CLOCK",
      "atc-darts-per-target",
      { ...baseRangeQuery, status: "completed" },
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("VALIDATION_FAILED");
      expect(result.details?.reason).toBe(
        `range holds ${dartCount} darts; server sections fold at most ${MAX_FOLD_DARTS} — request a shorter range`,
      );
    }
    expect(repo.findDartFoldRows).not.toHaveBeenCalled();
  });

  it("dispatches atc-darts-per-target through the fold on AROUND_THE_CLOCK", async () => {
    vi.mocked(repo.findGameDataVersion).mockResolvedValue({
      count: 1,
      maxCompletedAt: null,
    });
    vi.mocked(repo.findScopeDartCount).mockResolvedValue(1);
    vi.mocked(repo.findDartFoldRows).mockResolvedValue([
      makeAtcFoldRow(),
    ] as never);

    const result = await getGameSection(
      playerId,
      "AROUND_THE_CLOCK",
      "atc-darts-per-target",
      { ...baseRangeQuery, status: "completed" },
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.sectionId).toBe("atc-darts-per-target");
      expect(result.data.buckets[0]!.metrics).toEqual({
        "AROUND_THE_CLOCK_V1|difficulty=|segment_rule=": {
          "NUMBER:1": { darts: 1, cleared: 1 },
        },
      });
      expect(
        (result.data as { skippedSessions?: number }).skippedSessions,
      ).toBe(0);
    }
  });

  it("dispatches bobs27-survival through the fold on BOBS27", async () => {
    vi.mocked(repo.findGameDataVersion).mockResolvedValue({
      count: 1,
      maxCompletedAt: null,
    });
    vi.mocked(repo.findScopeDartCount).mockResolvedValue(1);
    vi.mocked(repo.findDartFoldRows).mockResolvedValue(
      makeBobs27FoldRows() as never,
    );

    const result = await getGameSection(playerId, "BOBS27", "bobs27-survival", {
      ...baseRangeQuery,
      status: "completed",
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.sectionId).toBe("bobs27-survival");
      const [group] = Object.values(
        result.data.buckets[0]!.metrics as unknown as Record<
          string,
          { runs: number; reached: Record<string, number> }
        >,
      );
      expect(group!.runs).toBe(1);
      expect(group!.reached).toEqual({ "DOUBLE:1": 1 });
    }
  });

  it("returns NOT_FOUND for bobs27-survival on DOUBLES_TRAINING (game-gated to BOBS27)", async () => {
    const result = await getGameSection(
      playerId,
      "DOUBLES_TRAINING",
      "bobs27-survival",
      { ...baseRangeQuery, status: "completed" },
    );

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("NOT_FOUND");
    expect(repo.findScopeDartCount).not.toHaveBeenCalled();
  });

  it("dispatches shanghai-count through the fold on SHANGHAI", async () => {
    vi.mocked(repo.findGameDataVersion).mockResolvedValue({
      count: 1,
      maxCompletedAt: null,
    });
    vi.mocked(repo.findScopeDartCount).mockResolvedValue(1);
    vi.mocked(repo.findDartFoldRows).mockResolvedValue([
      makeShanghaiFoldRow(),
    ] as never);

    const result = await getGameSection(
      playerId,
      "SHANGHAI",
      "shanghai-count",
      { ...baseRangeQuery, status: "completed" },
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.sectionId).toBe("shanghai-count");
      expect(result.data.buckets[0]!.metrics).toEqual({
        sessions: 1,
        shanghais: 0,
        byRound: {},
      });
    }
  });

  it("dispatches training-result through the fold on SINGLES_TRAINING", async () => {
    vi.mocked(repo.findGameDataVersion).mockResolvedValue({
      count: 1,
      maxCompletedAt: null,
    });
    vi.mocked(repo.findScopeDartCount).mockResolvedValue(1);
    vi.mocked(repo.findDartFoldRows).mockResolvedValue([
      makeShanghaiFoldRow({
        sessionId: "s-singles",
        gameTypeKey: "SINGLES_TRAINING",
        rulesetVersionKey: "SINGLES_V3",
        configuration: {
          seats: SEATS,
          order_mode: "LOW_TO_HIGH",
          target_order: [...Array.from({ length: 20 }, (_, i) => i + 1), 25],
          difficulty: "EASY",
          scoring_mode: "STANDARD",
        },
        hitZoneKey: "TREBLE",
      }),
    ] as never);

    const result = await getGameSection(
      playerId,
      "SINGLES_TRAINING",
      "training-result",
      { ...baseRangeQuery, status: "completed" },
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.sectionId).toBe("training-result");
      expect(result.data.buckets[0]!.metrics).toEqual({
        "SINGLES_V3|difficulty=EASY|scoring_mode=STANDARD": {
          sessions: 1,
          total: 3,
          best: 3,
        },
      });
    }
  });

  it("rejects a non-NUMBER/BULL heatmap target on SHANGHAI", async () => {
    for (const target of ["DOUBLE:16", "BULL:20", "NUMBER:21"]) {
      const result = await getGameSection(playerId, "SHANGHAI", "heatmap", {
        ...baseRangeQuery,
        status: "completed",
        target,
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe("VALIDATION_FAILED");
        expect(result.details?.reason).toContain("target");
      }
    }
    expect(repo.findHeatmapCells).not.toHaveBeenCalled();
    expect(repo.findDartFoldRows).not.toHaveBeenCalled();
  });

  it("folds a NUMBER target heatmap on SHANGHAI through findDartFoldRows", async () => {
    vi.mocked(repo.findGameDataVersion).mockResolvedValue({
      count: 1,
      maxCompletedAt: null,
    });
    vi.mocked(repo.findScopeDartCount).mockResolvedValue(1);
    vi.mocked(repo.findDartFoldRows).mockResolvedValue([
      makeShanghaiFoldRow({ locationX: -2.5, locationY: 5 }),
    ] as never);

    const result = await getGameSection(playerId, "SHANGHAI", "heatmap", {
      ...baseRangeQuery,
      status: "completed",
      target: "NUMBER:1",
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.buckets[0]!.metrics).toEqual({
        cellMm: 5,
        target: "NUMBER:1",
        cells: [[-1, 1, 1]],
      });
      expect(
        (result.data as { skippedSessions?: number }).skippedSessions,
      ).toBe(0);
    }
    expect(repo.findDartFoldRows).toHaveBeenCalled();
    expect(repo.findHeatmapCells).not.toHaveBeenCalled();
  });

  it("keeps the unfiltered heatmap on SHANGHAI in SQL", async () => {
    vi.mocked(repo.findHeatmapCells).mockResolvedValue([]);

    const result = await getGameSection(playerId, "SHANGHAI", "heatmap", {
      ...baseRangeQuery,
      status: "completed",
    });

    expect(result.ok).toBe(true);
    expect(repo.findHeatmapCells).toHaveBeenCalled();
    expect(repo.findDartFoldRows).not.toHaveBeenCalled();
  });

  it("resolves a heatmap handler on every derived game with and without a target", () => {
    for (const game of [
      "SHANGHAI",
      "SINGLES_TRAINING",
      "AROUND_THE_CLOCK",
    ] as const) {
      expect(resolveSectionHandler("heatmap", game)).toBeDefined();
      expect(resolveSectionHandler("heatmap", game, true)).toBeDefined();
    }
  });
});

function makeReplaySessionRow(
  overrides: Partial<ReplaySessionRow> = {},
): ReplaySessionRow {
  return {
    sessionId: "session-1",
    gameTypeKey: "501",
    rulesetVersionKey: "501_V1",
    inputModeKey: "VISUAL_BOARD",
    statusKey: "COMPLETED",
    contextKey: "STANDALONE",
    activityId: "activity-1",
    routineStepSequenceNumber: null,
    configuration: null,
    startedAt: "2026-09-01T10:00:00.000Z",
    completedAt: "2026-09-01T10:10:00.000Z",
    durationSeconds: 600,
    turnCount: 4,
    dartCount: 12,
    exerciseTypeKey: "GAME",
    exerciseRulesetVersionKey: null,
    routineKey: null,
    stepKey: null,
    ...overrides,
  };
}

function makeReplayStage(
  overrides: Partial<ReplayStageRow> = {},
): ReplayStageRow {
  return {
    stageId: "stage-1",
    parentStageId: null,
    stageTypeKey: "LEG",
    sequence: 1,
    ...overrides,
  };
}

function makeReplayParticipant(
  overrides: Partial<ReplayParticipantRow> = {},
): ReplayParticipantRow {
  return {
    participantId: "participant-1",
    displayName: "Alex",
    participantTypeKey: "PLAYER",
    ...overrides,
  };
}

function makeReplayTotalOnlyRow(overrides: Partial<ReplayRow> = {}): ReplayRow {
  return {
    stageId: "stage-1",
    turnSequence: 1,
    participantId: "participant-1",
    participantName: "Alex",
    participantTypeKey: "PLAYER",
    turnTotalScore: 60,
    dartNumber: null,
    intendedTargetNumber: null,
    intendedZoneKey: null,
    hitTargetNumber: null,
    hitZoneKey: null,
    score: null,
    locationX: null,
    locationY: null,
    ...overrides,
  };
}

describe("getSessionReplay", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns NOT_FOUND when the session gate finds no row, and calls no other reader", async () => {
    vi.mocked(repo.findReplaySession).mockResolvedValue(null);

    const result = await getSessionReplay(playerId, "session-1", {
      cursor: null,
      limit: 30,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("NOT_FOUND");
    expect(repo.findReplayStages).not.toHaveBeenCalled();
    expect(repo.findReplayTurnPage).not.toHaveBeenCalled();
    expect(repo.findReplayParticipants).not.toHaveBeenCalled();
  });

  it("returns NOT_FOUND for an ACTIVE step session (fix round 1, item 1): v_stats_routine_step_facts is terminal-only (migration 0045:188, WHERE gs.implementation_key IN ('COMPLETED', 'ABANDONED')), so findReplaySession's fallback query can never return an ACTIVE session's row", async () => {
    vi.mocked(repo.findReplaySession).mockResolvedValue(null);

    const result = await getSessionReplay(playerId, "session-1", {
      cursor: null,
      limit: 30,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("NOT_FOUND");
  });

  it("returns VALIDATION_FAILED for a malformed cursor, without paging turns", async () => {
    vi.mocked(repo.findReplaySession).mockResolvedValue(makeReplaySessionRow());
    vi.mocked(repo.findReplayStages).mockResolvedValue([makeReplayStage()]);

    const result = await getSessionReplay(playerId, "session-1", {
      cursor: "%%%",
      limit: 30,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("VALIDATION_FAILED");
      expect(result.details?.reason).toBeDefined();
    }
    expect(repo.findReplayTurnPage).not.toHaveBeenCalled();
    expect(repo.findReplayParticipants).not.toHaveBeenCalled();
  });

  it("returns VALIDATION_FAILED when the cursor's stage does not belong to this session", async () => {
    vi.mocked(repo.findReplaySession).mockResolvedValue(makeReplaySessionRow());
    vi.mocked(repo.findReplayStages).mockResolvedValue([
      makeReplayStage({ stageId: "stage-1" }),
    ]);

    const cursor = encodeReplayCursor({
      stageId: "other-session-stage",
      turnSequence: 1,
    });
    const result = await getSessionReplay(playerId, "session-1", {
      cursor,
      limit: 30,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("VALIDATION_FAILED");
    expect(repo.findReplayTurnPage).not.toHaveBeenCalled();
    expect(repo.findReplayParticipants).not.toHaveBeenCalled();
  });

  it("returns nextCursor null when exactly limit turns come back", async () => {
    vi.mocked(repo.findReplaySession).mockResolvedValue(makeReplaySessionRow());
    vi.mocked(repo.findReplayStages).mockResolvedValue([makeReplayStage()]);
    vi.mocked(repo.findReplayParticipants).mockResolvedValue([
      makeReplayParticipant(),
    ]);
    vi.mocked(repo.findReplayTurnPage).mockResolvedValue([
      makeReplayTotalOnlyRow({ turnSequence: 1 }),
    ]);

    const result = await getSessionReplay(playerId, "session-1", {
      cursor: null,
      limit: 1,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.turns).toHaveLength(1);
      expect(result.data.nextCursor).toBeNull();
    }
  });

  it("drops the extra turn and sets nextCursor from the last kept turn when limit+1 turns come back", async () => {
    vi.mocked(repo.findReplaySession).mockResolvedValue(makeReplaySessionRow());
    vi.mocked(repo.findReplayStages).mockResolvedValue([makeReplayStage()]);
    vi.mocked(repo.findReplayParticipants).mockResolvedValue([
      makeReplayParticipant(),
    ]);
    vi.mocked(repo.findReplayTurnPage).mockResolvedValue([
      makeReplayTotalOnlyRow({ turnSequence: 1 }),
      makeReplayTotalOnlyRow({ turnSequence: 2 }),
    ]);

    const result = await getSessionReplay(playerId, "session-1", {
      cursor: null,
      limit: 1,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.turns).toHaveLength(1);
      expect(result.data.turns[0]!.turnSequence).toBe(1);
      expect(result.data.nextCursor).not.toBeNull();
      expect(decodeReplayCursor(result.data.nextCursor!)).toEqual({
        stageId: "stage-1",
        turnSequence: 1,
      });
    }
  });

  it("passes the cursor stage's 1-based position to findReplayTurnPage, and omits the header", async () => {
    vi.mocked(repo.findReplaySession).mockResolvedValue(makeReplaySessionRow());
    vi.mocked(repo.findReplayStages).mockResolvedValue([
      makeReplayStage({ stageId: "leg-1", sequence: 1 }),
      makeReplayStage({ stageId: "leg-2", sequence: 2 }),
    ]);
    vi.mocked(repo.findReplayTurnPage).mockResolvedValue([]);

    const cursor = encodeReplayCursor({ stageId: "leg-2", turnSequence: 3 });
    const result = await getSessionReplay(playerId, "session-1", {
      cursor,
      limit: 30,
    });

    expect(repo.findReplayTurnPage).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        after: { position: 2, turnSequence: 3 },
      }),
    );
    expect(repo.findReplayParticipants).not.toHaveBeenCalled();
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.header).toBeNull();
  });

  it("builds the header from the session row, ordered stages and participants only on the first page", async () => {
    vi.mocked(repo.findReplaySession).mockResolvedValue(
      makeReplaySessionRow({ sessionId: "session-1" }),
    );
    vi.mocked(repo.findReplayStages).mockResolvedValue([
      makeReplayStage({ stageId: "leg-2", sequence: 2 }),
      makeReplayStage({ stageId: "leg-1", sequence: 1 }),
    ]);
    vi.mocked(repo.findReplayParticipants).mockResolvedValue([
      makeReplayParticipant({ participantId: "participant-1" }),
    ]);
    vi.mocked(repo.findReplayTurnPage).mockResolvedValue([]);

    const result = await getSessionReplay(playerId, "session-1", {
      cursor: null,
      limit: 30,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.header?.sessionId).toBe("session-1");
      expect(result.data.header?.participants).toEqual([
        makeReplayParticipant({ participantId: "participant-1" }),
      ]);
      expect(result.data.header?.stages.map((s) => s.stageId)).toEqual([
        "leg-1",
        "leg-2",
      ]);
    }
    expect(repo.findReplayParticipants).toHaveBeenCalledWith(
      expect.anything(),
      playerId,
      "session-1",
      ["leg-1", "leg-2"],
    );
  });

  it("carries routineKey and stepKey through for a GAME routine step, resolved through v_stats_session_facts (phase 6b decision 11, R6)", async () => {
    vi.mocked(repo.findReplaySession).mockResolvedValue(
      makeReplaySessionRow({
        sessionId: "session-1",
        contextKey: "ROUTINE",
        routineStepSequenceNumber: 2,
        exerciseTypeKey: "GAME",
        routineKey: "name-abc123",
        stepKey: "2-def456",
      }),
    );
    vi.mocked(repo.findReplayStages).mockResolvedValue([]);
    vi.mocked(repo.findReplayParticipants).mockResolvedValue([]);
    vi.mocked(repo.findReplayTurnPage).mockResolvedValue([]);

    const result = await getSessionReplay(playerId, "session-1", {
      cursor: null,
      limit: 30,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.header?.gameTypeKey).toBe("501");
      expect(result.data.header?.routineKey).toBe("name-abc123");
      expect(result.data.header?.stepKey).toBe("2-def456");
      expect(result.data.header?.exerciseTypeKey).toBe("GAME");
    }
  });

  it("returns an empty header, no turns, and no cursor for a session with no stages (never started)", async () => {
    vi.mocked(repo.findReplaySession).mockResolvedValue(
      makeReplaySessionRow({ turnCount: 0, dartCount: 0 }),
    );
    vi.mocked(repo.findReplayStages).mockResolvedValue([]);
    vi.mocked(repo.findReplayParticipants).mockResolvedValue([]);
    vi.mocked(repo.findReplayTurnPage).mockResolvedValue([]);

    const result = await getSessionReplay(playerId, "session-1", {
      cursor: null,
      limit: 30,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.header?.stages).toEqual([]);
      expect(result.data.turns).toEqual([]);
      expect(result.data.nextCursor).toBeNull();
    }
  });

  it("pages a two-leg 501 fixture across the leg boundary without losing or repeating a turn", async () => {
    const stageIds = ["leg-1", "leg-2"];
    const rows: ReplayRow[] = [
      makeReplayTotalOnlyRow({
        stageId: "leg-1",
        turnSequence: 1,
        turnTotalScore: 60,
      }),
      makeReplayTotalOnlyRow({
        stageId: "leg-1",
        turnSequence: 2,
        turnTotalScore: 45,
      }),
      makeReplayTotalOnlyRow({
        stageId: "leg-2",
        turnSequence: 1,
        turnTotalScore: 30,
      }),
      makeReplayTotalOnlyRow({
        stageId: "leg-2",
        turnSequence: 2,
        turnTotalScore: 20,
      }),
    ];

    vi.mocked(repo.findReplaySession).mockResolvedValue(makeReplaySessionRow());
    vi.mocked(repo.findReplayStages).mockResolvedValue([
      makeReplayStage({ stageId: "leg-1", sequence: 1 }),
      makeReplayStage({ stageId: "leg-2", sequence: 2 }),
    ]);
    vi.mocked(repo.findReplayParticipants).mockResolvedValue([
      makeReplayParticipant(),
    ]);
    vi.mocked(repo.findReplayTurnPage).mockImplementation(
      async (
        _db,
        q: {
          after: { position: number; turnSequence: number } | null;
          limit: number;
        },
      ) => {
        const withPos = rows.map((row) => ({
          row,
          pos: stageIds.indexOf(row.stageId) + 1,
        }));
        const remaining = q.after
          ? withPos.filter(
              ({ pos, row }) =>
                pos > q.after!.position ||
                (pos === q.after!.position &&
                  row.turnSequence > q.after!.turnSequence),
            )
          : withPos;
        const turnKeys: string[] = [];
        for (const { row } of remaining) {
          const key = `${row.stageId}:${row.turnSequence}`;
          if (!turnKeys.includes(key)) turnKeys.push(key);
        }
        const keptKeys = new Set(turnKeys.slice(0, q.limit + 1));
        return remaining
          .filter(({ row }) =>
            keptKeys.has(`${row.stageId}:${row.turnSequence}`),
          )
          .map(({ row }) => row);
      },
    );

    const page1 = await getSessionReplay(playerId, "session-1", {
      cursor: null,
      limit: 3,
    });
    expect(page1.ok).toBe(true);
    if (!page1.ok) return;
    expect(
      page1.data.turns.map((t) => `${t.stageId}:${t.turnSequence}`),
    ).toEqual(["leg-1:1", "leg-1:2", "leg-2:1"]);
    expect(page1.data.nextCursor).not.toBeNull();

    const page2 = await getSessionReplay(playerId, "session-1", {
      cursor: page1.data.nextCursor!,
      limit: 3,
    });
    expect(page2.ok).toBe(true);
    if (!page2.ok) return;
    expect(
      page2.data.turns.map((t) => `${t.stageId}:${t.turnSequence}`),
    ).toEqual(["leg-2:2"]);
    expect(page2.data.nextCursor).toBeNull();
    expect(page2.data.header).toBeNull();
  });
});

const routineKey = "0198f200-0000-7000-8000-000000000099";
const legacyRoutineKey = `name-${"b".repeat(32)}`;
const gameStepKey = `1-${"a".repeat(32)}`;
const exerciseStepKey = `2-${"c".repeat(32)}`;
const warmUpStepKey = `3-${"d".repeat(32)}`;

function makeRoutineHeaderRow(overrides: Record<string, unknown> = {}) {
  return {
    routineKey,
    routineName: "Evening Practice",
    runCount: 5,
    firstRunAt: "2026-01-01T00:00:00.000Z",
    lastRunAt: "2026-01-10T00:00:00.000Z",
    latestStepCount: 2,
    ...overrides,
  };
}

function makeGameStepDescriptorRow(overrides: Record<string, unknown> = {}) {
  return {
    stepKey: gameStepKey,
    sequenceNumber: 1,
    exerciseTypeKey: "GAME",
    exerciseRulesetVersionKey: null,
    gameTypeKey: "501" as GameTypeKey,
    rulesetVersionKey: "501_V1",
    durationSeconds: 300,
    sessionCount: 3,
    firstSeenAt: "2026-01-01T00:00:00.000Z",
    lastSeenAt: "2026-01-10T00:00:00.000Z",
    current: true,
    ...overrides,
  };
}

function makeExerciseStepDescriptorRow(
  overrides: Record<string, unknown> = {},
) {
  return {
    stepKey: exerciseStepKey,
    sequenceNumber: 2,
    exerciseTypeKey: "SWITCHING",
    exerciseRulesetVersionKey: "SWITCHING_V1",
    gameTypeKey: null,
    rulesetVersionKey: null,
    durationSeconds: 180,
    sessionCount: 4,
    firstSeenAt: "2026-01-01T00:00:00.000Z",
    lastSeenAt: "2026-01-10T00:00:00.000Z",
    current: true,
    ...overrides,
  };
}

function makeWarmUpStepDescriptorRow(overrides: Record<string, unknown> = {}) {
  return {
    stepKey: warmUpStepKey,
    sequenceNumber: 3,
    exerciseTypeKey: "WARM_UP",
    exerciseRulesetVersionKey: null,
    gameTypeKey: null,
    rulesetVersionKey: null,
    durationSeconds: 60,
    sessionCount: 2,
    firstSeenAt: "2026-01-01T00:00:00.000Z",
    lastSeenAt: "2026-01-10T00:00:00.000Z",
    current: true,
    ...overrides,
  };
}

function makeRoutineRunBucketRow(overrides: Record<string, unknown> = {}) {
  return {
    bucketStart: "2026-01-01T00:00:00.000Z",
    bucketEnd: "2026-02-01T00:00:00.000Z",
    runs: 3,
    durationSum: 900,
    durationMin: 200,
    durationMax: 400,
    darts: 90,
    completed: 2,
    abandoned: 1,
    neverStarted: 0,
    stepsCompletedAtAbandon: { "1": 1 },
    ...overrides,
  };
}

function makeStepBucketRow(overrides: Record<string, unknown> = {}) {
  return {
    bucketStart: "2026-01-01T00:00:00.000Z",
    bucketEnd: "2026-02-01T00:00:00.000Z",
    sessions: 4,
    durationSum: 600,
    darts: 40,
    ...overrides,
  };
}

function makeStepSessionRow(overrides: Record<string, unknown> = {}) {
  return {
    sessionId: "step-session-1",
    rulesetVersionKey: null,
    exerciseRulesetVersionKey: "SWITCHING_V1",
    statusKey: "COMPLETED",
    neverStarted: false,
    startedAt: "2026-01-01T00:00:00.000Z",
    completedAt: "2026-01-01T00:05:00.000Z",
    durationSeconds: 300,
    turnCount: 5,
    dartCount: 15,
    countedScore: 40,
    ...overrides,
  };
}

const STEP_FOLD_STAGE_ID = "01900000-0000-7000-9000-000000000001";

/** One Switching dart hitting cycling target 20 on the treble -- 3 points, 1 dart, 1 hit (mirrors `step-result.module.test.ts`'s fixture). */
function makeSwitchingFoldRow(overrides: Record<string, unknown> = {}) {
  return {
    sessionId: "fold-session-1",
    completedAt: "2026-01-05T00:00:00.000Z",
    exerciseRulesetVersionKey: "SWITCHING_V1",
    configuration: {
      targets: [20, 19, 18],
      scoring: { single: 1, double: 2, treble: 3 },
    },
    stageId: STEP_FOLD_STAGE_ID,
    stageSequence: 1,
    stageTypeKey: "EXERCISE_BLOCK",
    parentStageId: null,
    turnSequence: 1,
    participantId: "solo",
    participantName: "Solo",
    participantTypeKey: "PLAYER",
    turnTotalScore: 3,
    dartNumber: 1,
    intendedTargetNumber: 20,
    intendedZoneKey: "TREBLE" as DartZoneKey,
    hitTargetNumber: 20,
    hitZoneKey: "TREBLE" as DartZoneKey,
    score: 3,
    locationX: null,
    locationY: null,
    bucketStart: "2026-01-01T00:00:00.000Z",
    bucketEnd: "2026-02-01T00:00:00.000Z",
    ...overrides,
  };
}

const routineRangeQuery = {
  from: "2026-01-01T00:00:00.000Z",
  to: "2026-02-01T00:00:00.000Z",
  tz: undefined,
  bucket: "none" as const,
  status: undefined,
};

describe("listTrainedRoutines", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns every trained routine as-is, newest first", async () => {
    const rows = [
      {
        routineKey,
        routineTemplateId: null,
        routineName: "Evening Practice",
        runCount: 5,
        completedRunCount: 4,
        lastRunAt: "2026-01-10T00:00:00.000Z",
      },
    ];
    vi.mocked(repo.findTrainedRoutines).mockResolvedValue(rows);

    const result = await listTrainedRoutines(playerId);

    expect(result).toEqual({ ok: true, data: { items: rows } });
    expect(repo.findTrainedRoutines).toHaveBeenCalledWith(
      expect.anything(),
      playerId,
    );
  });

  it("returns an empty list for a player who has trained nothing", async () => {
    vi.mocked(repo.findTrainedRoutines).mockResolvedValue([]);

    const result = await listTrainedRoutines(playerId);

    expect(result).toEqual({ ok: true, data: { items: [] } });
  });
});

describe("getRoutineHeader", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rejects a malformed routineKey without calling the repository", async () => {
    const result = await getRoutineHeader(playerId, "not-a-routine-key");

    expect(result).toEqual({
      ok: false,
      code: "VALIDATION_FAILED",
      details: { reason: "routineKey is malformed" },
    });
    expect(repo.findRoutineHeader).not.toHaveBeenCalled();
  });

  it("returns NOT_FOUND for another player's routine, with no further reader called", async () => {
    vi.mocked(repo.findRoutineHeader).mockResolvedValue(null);

    const result = await getRoutineHeader(playerId, routineKey);

    expect(result).toEqual({ ok: false, code: "NOT_FOUND" });
    expect(repo.findRoutineStepDescriptors).not.toHaveBeenCalled();
    expect(repo.findRoutineDataVersion).not.toHaveBeenCalled();
  });

  it("resolves a legacy name- routine key", async () => {
    vi.mocked(repo.findRoutineHeader).mockResolvedValue(
      makeRoutineHeaderRow({ routineKey: legacyRoutineKey }),
    );
    vi.mocked(repo.findRoutineStepDescriptors).mockResolvedValue([]);
    vi.mocked(repo.findRoutineDataVersion).mockResolvedValue({
      runCount: 5,
      maxCompletedAt: "2026-01-10T00:00:00.000Z",
    });

    const result = await getRoutineHeader(playerId, legacyRoutineKey);

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.routineKey).toBe(legacyRoutineKey);
  });

  it("assembles the header from findRoutineHeader, its step descriptors and the encoded dataVersion", async () => {
    vi.mocked(repo.findRoutineHeader).mockResolvedValue(makeRoutineHeaderRow());
    const steps = [
      makeGameStepDescriptorRow(),
      makeExerciseStepDescriptorRow(),
    ];
    vi.mocked(repo.findRoutineStepDescriptors).mockResolvedValue(steps);
    vi.mocked(repo.findRoutineDataVersion).mockResolvedValue({
      runCount: 5,
      maxCompletedAt: "2026-01-10T00:00:00.000Z",
    });

    const result = await getRoutineHeader(playerId, routineKey);

    expect(repo.findRoutineStepDescriptors).toHaveBeenCalledWith(
      expect.anything(),
      playerId,
      routineKey,
      2,
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toEqual({
        routineKey,
        routineName: "Evening Practice",
        runCount: 5,
        firstRunAt: "2026-01-01T00:00:00.000Z",
        lastRunAt: "2026-01-10T00:00:00.000Z",
        dataVersion: expect.any(String),
        steps,
      });
    }
  });
});

describe("getRoutineSection", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rejects a malformed routineKey without calling the repository", async () => {
    const result = await getRoutineSection(
      playerId,
      "not-a-routine-key",
      "routine-volume",
      routineRangeQuery,
    );

    expect(result).toEqual({
      ok: false,
      code: "VALIDATION_FAILED",
      details: { reason: "routineKey is malformed" },
    });
    expect(repo.findRoutineHeader).not.toHaveBeenCalled();
  });

  it("returns NOT_FOUND for another player's routine, with no section reader called", async () => {
    vi.mocked(repo.findRoutineHeader).mockResolvedValue(null);

    const result = await getRoutineSection(
      playerId,
      routineKey,
      "routine-volume",
      routineRangeQuery,
    );

    expect(result).toEqual({ ok: false, code: "NOT_FOUND" });
    expect(repo.findRoutineRunBuckets).not.toHaveBeenCalled();
  });

  it("returns NOT_FOUND for a section outside sectionsForRoutine()", async () => {
    vi.mocked(repo.findRoutineHeader).mockResolvedValue(makeRoutineHeaderRow());

    const result = await getRoutineSection(
      playerId,
      routineKey,
      "step-volume",
      routineRangeQuery,
    );

    expect(result).toEqual({ ok: false, code: "NOT_FOUND" });
    expect(repo.findRoutineRunBuckets).not.toHaveBeenCalled();
  });

  it("rejects a status other than all on routine-completion (includesAbandoned)", async () => {
    vi.mocked(repo.findRoutineHeader).mockResolvedValue(makeRoutineHeaderRow());

    const result = await getRoutineSection(
      playerId,
      routineKey,
      "routine-completion",
      { ...routineRangeQuery, status: "completed" },
    );

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("VALIDATION_FAILED");
  });

  it("rejects status=all on routine-volume, which does not include abandoned runs", async () => {
    vi.mocked(repo.findRoutineHeader).mockResolvedValue(makeRoutineHeaderRow());

    const result = await getRoutineSection(
      playerId,
      routineKey,
      "routine-volume",
      {
        ...routineRangeQuery,
        status: "all",
      },
    );

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("VALIDATION_FAILED");
    expect(repo.findRoutineRunBuckets).not.toHaveBeenCalled();
  });

  it("passes routine-completion's default statuses (both COMPLETED and ABANDONED) to findRoutineRunBuckets", async () => {
    vi.mocked(repo.findRoutineHeader).mockResolvedValue(makeRoutineHeaderRow());
    vi.mocked(repo.findRoutineDataVersion).mockResolvedValue({
      runCount: 5,
      maxCompletedAt: "2026-01-10T00:00:00.000Z",
    });
    vi.mocked(repo.findRoutineRunBuckets).mockResolvedValue([]);

    await getRoutineSection(
      playerId,
      routineKey,
      "routine-completion",
      routineRangeQuery,
    );

    expect(repo.findRoutineRunBuckets).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ statuses: ["COMPLETED", "ABANDONED"] }),
    );
  });

  it("floors from to the bucket start when bucketed, and echoes it in range", async () => {
    vi.mocked(repo.findRoutineHeader).mockResolvedValue(makeRoutineHeaderRow());
    vi.mocked(repo.findBucketFloor).mockResolvedValue(
      "2026-01-01T00:00:00.000Z",
    );
    vi.mocked(repo.findRoutineDataVersion).mockResolvedValue({
      runCount: 5,
      maxCompletedAt: "2026-01-10T00:00:00.000Z",
    });
    vi.mocked(repo.findRoutineRunBuckets).mockResolvedValue([]);

    const result = await getRoutineSection(
      playerId,
      routineKey,
      "routine-volume",
      {
        ...routineRangeQuery,
        from: "2026-01-15T00:00:00.000Z",
        bucket: "month",
        tz: "Europe/Amsterdam",
      },
    );

    expect(repo.findBucketFloor).toHaveBeenCalledWith(
      expect.anything(),
      "2026-01-15T00:00:00.000Z",
      "month",
      "Europe/Amsterdam",
    );
    expect(result.ok).toBe(true);
    if (result.ok)
      expect(result.data.range.from).toBe("2026-01-01T00:00:00.000Z");
  });

  it("dispatches routine-volume through findRoutineRunBuckets, with an encoded dataVersion", async () => {
    vi.mocked(repo.findRoutineHeader).mockResolvedValue(makeRoutineHeaderRow());
    vi.mocked(repo.findRoutineDataVersion).mockResolvedValue({
      runCount: 5,
      maxCompletedAt: "2026-01-10T00:00:00.000Z",
    });
    vi.mocked(repo.findRoutineRunBuckets).mockResolvedValue([
      makeRoutineRunBucketRow(),
    ]);

    const result = await getRoutineSection(
      playerId,
      routineKey,
      "routine-volume",
      routineRangeQuery,
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.sectionId).toBe("routine-volume");
      expect(result.data.buckets).toHaveLength(1);
      expect((result.data.buckets[0]!.metrics as { runs: number }).runs).toBe(
        3,
      );
      expect(result.data.dataVersion).toBe(
        encodeDataVersion({
          count: 5,
          maxCompletedAt: "2026-01-10T00:00:00.000Z",
        }),
      );
    }
  });

  it("dispatches routine-completion through the same findRoutineRunBuckets reader", async () => {
    vi.mocked(repo.findRoutineHeader).mockResolvedValue(makeRoutineHeaderRow());
    vi.mocked(repo.findRoutineDataVersion).mockResolvedValue({
      runCount: 5,
      maxCompletedAt: "2026-01-10T00:00:00.000Z",
    });
    vi.mocked(repo.findRoutineRunBuckets).mockResolvedValue([
      makeRoutineRunBucketRow(),
    ]);

    const result = await getRoutineSection(
      playerId,
      routineKey,
      "routine-completion",
      { ...routineRangeQuery, status: "all" },
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.sectionId).toBe("routine-completion");
      expect(
        (
          result.data.buckets[0]!.metrics as {
            completed: number;
            abandoned: number;
            neverStarted: number;
          }
        ).completed,
      ).toBe(2);
    }
  });
});

describe("getRoutineStepSection", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rejects a malformed routineKey without calling the repository", async () => {
    const result = await getRoutineStepSection(
      playerId,
      "not-a-routine-key",
      exerciseStepKey,
      "step-volume",
      routineRangeQuery,
    );

    expect(result).toEqual({
      ok: false,
      code: "VALIDATION_FAILED",
      details: { reason: "routineKey is malformed" },
    });
    expect(repo.findRoutineHeader).not.toHaveBeenCalled();
  });

  it("rejects a malformed stepKey without calling the repository", async () => {
    const result = await getRoutineStepSection(
      playerId,
      routineKey,
      "not-a-step-key",
      "step-volume",
      routineRangeQuery,
    );

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("VALIDATION_FAILED");
    expect(repo.findRoutineHeader).not.toHaveBeenCalled();
  });

  it("treats a stepKey whose sequence number is not a safe integer as malformed", async () => {
    const unsafeStepKey = `99999999999999999999999-${"a".repeat(32)}`;

    const result = await getRoutineStepSection(
      playerId,
      routineKey,
      unsafeStepKey,
      "step-volume",
      routineRangeQuery,
    );

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("VALIDATION_FAILED");
    expect(repo.findRoutineHeader).not.toHaveBeenCalled();
  });

  it("returns NOT_FOUND for another player's routine, with no descriptor reader called", async () => {
    vi.mocked(repo.findRoutineHeader).mockResolvedValue(null);

    const result = await getRoutineStepSection(
      playerId,
      routineKey,
      exerciseStepKey,
      "step-volume",
      routineRangeQuery,
    );

    expect(result).toEqual({ ok: false, code: "NOT_FOUND" });
    expect(repo.findRoutineStepDescriptors).not.toHaveBeenCalled();
  });

  it("returns NOT_FOUND for a stepKey absent from the routine's descriptors", async () => {
    vi.mocked(repo.findRoutineHeader).mockResolvedValue(makeRoutineHeaderRow());
    vi.mocked(repo.findRoutineStepDescriptors).mockResolvedValue([
      makeGameStepDescriptorRow(),
    ]);

    const result = await getRoutineStepSection(
      playerId,
      routineKey,
      exerciseStepKey,
      "step-volume",
      routineRangeQuery,
    );

    expect(result).toEqual({ ok: false, code: "NOT_FOUND" });
  });

  it("resolves an earlier, non-current step key", async () => {
    vi.mocked(repo.findRoutineHeader).mockResolvedValue(makeRoutineHeaderRow());
    vi.mocked(repo.findRoutineStepDescriptors).mockResolvedValue([
      makeExerciseStepDescriptorRow({ current: false }),
    ]);
    vi.mocked(repo.findRoutineDataVersion).mockResolvedValue({
      runCount: 5,
      maxCompletedAt: "2026-01-10T00:00:00.000Z",
    });
    vi.mocked(repo.findStepBuckets).mockResolvedValue([makeStepBucketRow()]);

    const result = await getRoutineStepSection(
      playerId,
      routineKey,
      exerciseStepKey,
      "step-volume",
      routineRangeQuery,
    );

    expect(result.ok).toBe(true);
  });

  it("returns NOT_FOUND for a section outside sectionsForStep(step) (step-result on Warm-Up)", async () => {
    vi.mocked(repo.findRoutineHeader).mockResolvedValue(makeRoutineHeaderRow());
    vi.mocked(repo.findRoutineStepDescriptors).mockResolvedValue([
      makeWarmUpStepDescriptorRow(),
    ]);

    const result = await getRoutineStepSection(
      playerId,
      routineKey,
      warmUpStepKey,
      "step-result",
      routineRangeQuery,
    );

    expect(result).toEqual({ ok: false, code: "NOT_FOUND" });
    expect(repo.findStepScopeDartCount).not.toHaveBeenCalled();
    expect(repo.findStepFoldRows).not.toHaveBeenCalled();
  });

  it("floors from to the bucket start when bucketed, and echoes it in range", async () => {
    vi.mocked(repo.findRoutineHeader).mockResolvedValue(makeRoutineHeaderRow());
    vi.mocked(repo.findRoutineStepDescriptors).mockResolvedValue([
      makeExerciseStepDescriptorRow(),
    ]);
    vi.mocked(repo.findBucketFloor).mockResolvedValue(
      "2026-01-01T00:00:00.000Z",
    );
    vi.mocked(repo.findRoutineDataVersion).mockResolvedValue({
      runCount: 5,
      maxCompletedAt: "2026-01-10T00:00:00.000Z",
    });
    vi.mocked(repo.findStepBuckets).mockResolvedValue([]);

    const result = await getRoutineStepSection(
      playerId,
      routineKey,
      exerciseStepKey,
      "step-volume",
      {
        ...routineRangeQuery,
        from: "2026-01-15T00:00:00.000Z",
        bucket: "month",
        tz: "Europe/Amsterdam",
      },
    );

    expect(repo.findBucketFloor).toHaveBeenCalledWith(
      expect.anything(),
      "2026-01-15T00:00:00.000Z",
      "month",
      "Europe/Amsterdam",
    );
    expect(result.ok).toBe(true);
    if (result.ok)
      expect(result.data.range.from).toBe("2026-01-01T00:00:00.000Z");
  });

  it("dispatches step-volume through findStepBuckets", async () => {
    vi.mocked(repo.findRoutineHeader).mockResolvedValue(makeRoutineHeaderRow());
    vi.mocked(repo.findRoutineStepDescriptors).mockResolvedValue([
      makeExerciseStepDescriptorRow(),
    ]);
    vi.mocked(repo.findRoutineDataVersion).mockResolvedValue({
      runCount: 5,
      maxCompletedAt: "2026-01-10T00:00:00.000Z",
    });
    vi.mocked(repo.findStepBuckets).mockResolvedValue([makeStepBucketRow()]);

    const result = await getRoutineStepSection(
      playerId,
      routineKey,
      exerciseStepKey,
      "step-volume",
      routineRangeQuery,
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.sectionId).toBe("step-volume");
      expect(
        (result.data.buckets[0]!.metrics as { sessions: number }).sessions,
      ).toBe(4);
    }
  });

  it("returns VALIDATION_FAILED above MAX_FOLD_DARTS on step-result, and never calls findStepFoldRows", async () => {
    vi.mocked(repo.findRoutineHeader).mockResolvedValue(makeRoutineHeaderRow());
    vi.mocked(repo.findRoutineStepDescriptors).mockResolvedValue([
      makeExerciseStepDescriptorRow(),
    ]);
    vi.mocked(repo.findRoutineDataVersion).mockResolvedValue({
      runCount: 5,
      maxCompletedAt: "2026-01-10T00:00:00.000Z",
    });
    const dartCount = MAX_FOLD_DARTS + 1;
    vi.mocked(repo.findStepScopeDartCount).mockResolvedValue(dartCount);

    const result = await getRoutineStepSection(
      playerId,
      routineKey,
      exerciseStepKey,
      "step-result",
      routineRangeQuery,
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("VALIDATION_FAILED");
      expect(result.details?.reason).toBe(
        `range holds ${dartCount} darts; server sections fold at most ${MAX_FOLD_DARTS} — request a shorter range`,
      );
    }
    expect(repo.findStepFoldRows).not.toHaveBeenCalled();
  });

  it("dispatches step-result through findStepFoldRows and stepResultBuckets", async () => {
    vi.mocked(repo.findRoutineHeader).mockResolvedValue(makeRoutineHeaderRow());
    vi.mocked(repo.findRoutineStepDescriptors).mockResolvedValue([
      makeExerciseStepDescriptorRow(),
    ]);
    vi.mocked(repo.findRoutineDataVersion).mockResolvedValue({
      runCount: 5,
      maxCompletedAt: "2026-01-10T00:00:00.000Z",
    });
    vi.mocked(repo.findStepScopeDartCount).mockResolvedValue(1);
    vi.mocked(repo.findStepFoldRows).mockResolvedValue([
      makeSwitchingFoldRow(),
    ] as never);

    const result = await getRoutineStepSection(
      playerId,
      routineKey,
      exerciseStepKey,
      "step-result",
      routineRangeQuery,
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.sectionId).toBe("step-result");
      expect(result.data.buckets[0]!.metrics).toMatchObject({
        metrics: { points: 3, darts: 1, hits: 1 },
        sessions: 1,
        skippedSessions: 0,
      });
    }
  });

  it("delegates a GAME step to the game section path with context 'routine' and the exact routineStep, and keys dataVersion under the routine", async () => {
    vi.mocked(repo.findRoutineHeader).mockResolvedValue(makeRoutineHeaderRow());
    vi.mocked(repo.findRoutineStepDescriptors).mockResolvedValue([
      makeGameStepDescriptorRow(),
    ]);
    vi.mocked(repo.findRoutineDataVersion).mockResolvedValue({
      runCount: 9,
      maxCompletedAt: "2026-01-09T00:00:00.000Z",
    });
    vi.mocked(repo.findBucketedSessionAggregates).mockResolvedValue([]);

    const result = await getRoutineStepSection(
      playerId,
      routineKey,
      gameStepKey,
      "volume",
      routineRangeQuery,
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.sectionId).toBe("volume");
      expect(result.data.dataVersion).toBe(
        encodeDataVersion({
          count: 9,
          maxCompletedAt: "2026-01-09T00:00:00.000Z",
        }),
      );
    }
    expect(repo.findGameDataVersion).not.toHaveBeenCalled();
    expect(repo.findRoutineDataVersion).toHaveBeenCalledWith(
      expect.anything(),
      playerId,
      routineKey,
    );
    expect(repo.findBucketedSessionAggregates).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        context: "routine",
        routineStep: { routineKey, stepKey: gameStepKey },
      }),
    );
  });

  it("ignores a smuggled context and target on a GAME step's query, whatever the query held", async () => {
    vi.mocked(repo.findRoutineHeader).mockResolvedValue(makeRoutineHeaderRow());
    vi.mocked(repo.findRoutineStepDescriptors).mockResolvedValue([
      makeGameStepDescriptorRow(),
    ]);
    vi.mocked(repo.findRoutineDataVersion).mockResolvedValue({
      runCount: 9,
      maxCompletedAt: "2026-01-09T00:00:00.000Z",
    });
    vi.mocked(repo.findHeatmapCells).mockResolvedValue([]);

    const smuggledQuery = {
      ...routineRangeQuery,
      context: "standalone",
      target: "DOUBLE:16",
    } as unknown as RoutineSectionQuery;

    const result = await getRoutineStepSection(
      playerId,
      routineKey,
      gameStepKey,
      "heatmap",
      smuggledQuery,
    );

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.sectionId).toBe("heatmap");
    expect(repo.findHeatmapCells).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        context: "routine",
        target: null,
        routineStep: { routineKey, stepKey: gameStepKey },
      }),
    );
  });

  it.each([
    {
      name: "a phase 2 sql-site dart section (heatmap)",
      sectionId: "heatmap",
      setup: () => {
        vi.mocked(repo.findHeatmapCells).mockResolvedValue([]);
      },
      assertReader: () => {
        expect(repo.findHeatmapCells).toHaveBeenCalledWith(
          expect.anything(),
          expect.objectContaining({
            routineStep: { routineKey, stepKey: gameStepKey },
          }),
        );
      },
    },
    {
      name: "a server-folded section (checkout-rate)",
      sectionId: "checkout-rate",
      setup: () => {
        vi.mocked(repo.findScopeDartCount).mockResolvedValue(1);
        vi.mocked(repo.findX01FoldRows).mockResolvedValue([] as never);
      },
      assertReader: () => {
        expect(repo.findScopeDartCount).toHaveBeenCalledWith(
          expect.anything(),
          expect.objectContaining({
            routineStep: { routineKey, stepKey: gameStepKey },
          }),
        );
      },
    },
  ])(
    "threads routineStep into $name's own reader for a GAME step",
    async ({ sectionId, setup, assertReader }) => {
      vi.mocked(repo.findRoutineHeader).mockResolvedValue(
        makeRoutineHeaderRow(),
      );
      vi.mocked(repo.findRoutineStepDescriptors).mockResolvedValue([
        makeGameStepDescriptorRow(),
      ]);
      vi.mocked(repo.findRoutineDataVersion).mockResolvedValue({
        runCount: 1,
        maxCompletedAt: null,
      });
      setup();

      const result = await getRoutineStepSection(
        playerId,
        routineKey,
        gameStepKey,
        sectionId,
        { ...routineRangeQuery, status: "completed" },
      );

      expect(result.ok).toBe(true);
      assertReader();
    },
  );
});

describe("getGameSection validation order", () => {
  beforeEach(() => vi.clearAllMocks());

  it("checks target before status when both are invalid, naming the target error", async () => {
    const result = await getGameSection(playerId, "501", "heatmap", {
      ...baseRangeQuery,
      target: "DOUBLE:16",
      status: "abandoned",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("VALIDATION_FAILED");
      expect(result.details?.reason).toBe(
        "target requires an intent-stored game",
      );
    }
  });
});

describe("listRoutineStepSessions", () => {
  beforeEach(() => vi.clearAllMocks());

  const stepSessionListQuery = {
    from: "2026-01-01T00:00:00.000Z",
    to: "2026-02-01T00:00:00.000Z",
    status: undefined,
    limit: 25,
  };

  it("rejects a malformed routineKey without calling the repository", async () => {
    const result = await listRoutineStepSessions(
      playerId,
      "not-a-routine-key",
      exerciseStepKey,
      stepSessionListQuery,
    );

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("VALIDATION_FAILED");
    expect(repo.findRoutineHeader).not.toHaveBeenCalled();
  });

  it("returns NOT_FOUND for another player's routine", async () => {
    vi.mocked(repo.findRoutineHeader).mockResolvedValue(null);

    const result = await listRoutineStepSessions(
      playerId,
      routineKey,
      exerciseStepKey,
      stepSessionListQuery,
    );

    expect(result).toEqual({ ok: false, code: "NOT_FOUND" });
    expect(repo.findStepSessionPage).not.toHaveBeenCalled();
  });

  it("returns NOT_FOUND for a stepKey absent from the routine's descriptors", async () => {
    vi.mocked(repo.findRoutineHeader).mockResolvedValue(makeRoutineHeaderRow());
    vi.mocked(repo.findRoutineStepDescriptors).mockResolvedValue([
      makeGameStepDescriptorRow(),
    ]);

    const result = await listRoutineStepSessions(
      playerId,
      routineKey,
      exerciseStepKey,
      stepSessionListQuery,
    );

    expect(result).toEqual({ ok: false, code: "NOT_FOUND" });
  });

  it("rejects a malformed cursor", async () => {
    vi.mocked(repo.findRoutineHeader).mockResolvedValue(makeRoutineHeaderRow());
    vi.mocked(repo.findRoutineStepDescriptors).mockResolvedValue([
      makeExerciseStepDescriptorRow(),
    ]);

    const result = await listRoutineStepSessions(
      playerId,
      routineKey,
      exerciseStepKey,
      { ...stepSessionListQuery, cursor: "%%%" },
    );

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("VALIDATION_FAILED");
    expect(repo.findStepSessionPage).not.toHaveBeenCalled();
  });

  it("sets nextCursor when a further page exists (limit + 1 rows)", async () => {
    vi.mocked(repo.findRoutineHeader).mockResolvedValue(makeRoutineHeaderRow());
    vi.mocked(repo.findRoutineStepDescriptors).mockResolvedValue([
      makeExerciseStepDescriptorRow(),
    ]);
    vi.mocked(repo.findRoutineDataVersion).mockResolvedValue({
      runCount: 5,
      maxCompletedAt: "2026-01-10T00:00:00.000Z",
    });
    vi.mocked(repo.findStepSessionPage).mockResolvedValue([
      makeStepSessionRow({
        sessionId: "s1",
        completedAt: "2026-01-03T00:00:00.000Z",
      }),
      makeStepSessionRow({
        sessionId: "s2",
        completedAt: "2026-01-02T00:00:00.000Z",
      }),
    ]);

    const result = await listRoutineStepSessions(
      playerId,
      routineKey,
      exerciseStepKey,
      { ...stepSessionListQuery, limit: 1 },
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.items).toHaveLength(1);
      expect(result.data.nextCursor).not.toBeNull();
      expect(result.data.dataVersion).toEqual(expect.any(String));
    }
  });

  it("returns nextCursor null when exactly limit rows come back", async () => {
    vi.mocked(repo.findRoutineHeader).mockResolvedValue(makeRoutineHeaderRow());
    vi.mocked(repo.findRoutineStepDescriptors).mockResolvedValue([
      makeExerciseStepDescriptorRow(),
    ]);
    vi.mocked(repo.findRoutineDataVersion).mockResolvedValue({
      runCount: 5,
      maxCompletedAt: "2026-01-10T00:00:00.000Z",
    });
    vi.mocked(repo.findStepSessionPage).mockResolvedValue([
      makeStepSessionRow({}),
    ]);

    const result = await listRoutineStepSessions(
      playerId,
      routineKey,
      exerciseStepKey,
      { ...stepSessionListQuery, limit: 1 },
    );

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.nextCursor).toBeNull();
  });
});
