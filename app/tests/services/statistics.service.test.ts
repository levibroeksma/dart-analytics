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
}));

import * as repo from "@repositories/statistics.repository";
import {
  getStatisticsOverview,
  listGameSessions,
  getGameSection,
} from "@services/statistics.service";
import { SECTIONS } from "@lib/stats/section-registry";

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
    expect(result.highestCheckout).toEqual({ value: 40, timesHit: 1 });
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
    expect(result.highestCheckout).toEqual({ value: 40, timesHit: 1 });
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
});
