import { describe, it, expect, vi } from "vitest";
import { renderingDb, onlyStatement } from "./render-sql";
import {
  findGameSessionsPage,
  findGameDataVersion,
  findBucketedSessionAggregates,
  findBucketFloor,
  findIntentCells,
  findIntentMoments,
  findMissSectors,
  findHeatmapCells,
  findScopeDartCount,
  findX01FoldRows,
  findDartFoldRows,
  findVisitScoring,
  findHitNumberCells,
  findReplaySession,
  findReplayStages,
  findReplayParticipants,
  findReplayTurnPage,
  findTrainedRoutines,
  findRoutineHeader,
  findRoutineStepDescriptors,
  findRoutineDataVersion,
  findRoutineRunBuckets,
  findStepBuckets,
  findStepSessionPage,
  findStepFoldRows,
  findStepScopeDartCount,
} from "@repositories/statistics.repository";

function fakeSelect(rows: unknown[]) {
  const fromCalls: unknown[] = [];
  const chain = {
    from: vi.fn((table: unknown) => {
      fromCalls.push(table);
      return chain;
    }),
    where: vi.fn().mockResolvedValue(rows),
  };
  return { chain, fromCalls };
}

describe("findSessionSummaries", () => {
  it("reads from v_session_overview", async () => {
    const row = {
      gameTypeKey: "501",
      statusKey: "COMPLETED",
      startedAt: "2026-09-01T10:00:00.000Z",
      durationSeconds: 600,
    };
    const { chain, fromCalls } = fakeSelect([row]);
    const db = { select: vi.fn(() => chain) } as any;
    const { vSessionOverview } = await import("@db/schema");
    const { findSessionSummaries } =
      await import("@repositories/statistics.repository");

    const result = await findSessionSummaries(db, "p1");

    expect(result).toEqual([row]);
    expect(fromCalls).toEqual([vSessionOverview]);
  });

  it("throws instead of silently returning a null statusKey column", async () => {
    const { chain } = fakeSelect([
      {
        gameTypeKey: "501",
        statusKey: null,
        startedAt: "2026-09-01T10:00:00.000Z",
        durationSeconds: 600,
      },
    ]);
    const db = { select: vi.fn(() => chain) } as any;
    const { findSessionSummaries } =
      await import("@repositories/statistics.repository");

    await expect(findSessionSummaries(db, "p1")).rejects.toThrow(/status_key/);
  });
});

describe("findVisitFacts", () => {
  it("reads from v_player_visit_facts", async () => {
    const row = {
      sessionId: "s1",
      gameTypeKey: "501",
      stageId: "stage-1",
      stageTypeKey: "LEG",
      turnSequence: 1,
      totalScore: 60,
      dartCount: 3,
      configuredMaxDartsPerTurn: 3,
    };
    const { chain, fromCalls } = fakeSelect([row]);
    const db = { select: vi.fn(() => chain) } as any;
    const { vPlayerVisitFacts } = await import("@db/schema");
    const { findVisitFacts } =
      await import("@repositories/statistics.repository");

    const result = await findVisitFacts(db, "p1");

    expect(result).toEqual([row]);
    expect(fromCalls).toEqual([vPlayerVisitFacts]);
  });

  it("throws instead of silently returning a null stageId column", async () => {
    const { chain } = fakeSelect([
      {
        sessionId: "s1",
        gameTypeKey: "501",
        stageId: null,
        stageTypeKey: "LEG",
        turnSequence: 1,
        totalScore: 60,
        dartCount: 3,
        configuredMaxDartsPerTurn: 3,
      },
    ]);
    const db = { select: vi.fn(() => chain) } as any;
    const { findVisitFacts } =
      await import("@repositories/statistics.repository");

    await expect(findVisitFacts(db, "p1")).rejects.toThrow(/stage_id/);
  });
});

describe("findLegFacts", () => {
  it("reads from v_player_leg_facts and parses total_darts_in_leg to a number", async () => {
    const row = {
      sessionId: "s1",
      gameTypeKey: "501",
      stageId: "stage-1",
      totalDartsInLeg: "15",
    };
    const { chain, fromCalls } = fakeSelect([row]);
    const db = { select: vi.fn(() => chain) } as any;
    const { vPlayerLegFacts } = await import("@db/schema");
    const { findLegFacts } =
      await import("@repositories/statistics.repository");

    const result = await findLegFacts(db, "p1");

    expect(result).toEqual([
      {
        sessionId: "s1",
        gameTypeKey: "501",
        stageId: "stage-1",
        totalDartsInLeg: 15,
      },
    ]);
    expect(fromCalls).toEqual([vPlayerLegFacts]);
  });

  it("throws instead of silently returning a null totalDartsInLeg column", async () => {
    const { chain } = fakeSelect([
      {
        sessionId: "s1",
        gameTypeKey: "501",
        stageId: "stage-1",
        totalDartsInLeg: null,
      },
    ]);
    const db = { select: vi.fn(() => chain) } as any;
    const { findLegFacts } =
      await import("@repositories/statistics.repository");

    await expect(findLegFacts(db, "p1")).rejects.toThrow(/total_darts_in_leg/);
  });
});

function fakeOrderedQuery(rows: unknown[]) {
  return {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockResolvedValue(rows),
  };
}

/**
 * `findDoubleOutVisits` (and the `v_double_out_checkout_darts` view it read)
 * is gone — migration `0039` replaced it with `v_x01_checkout_darts`, a
 * facts-only view with no `SUM(d.score)` running total to get wrong on a
 * bust. Its grouping-and-subtraction guarantee has no equivalent to
 * re-point at: that computation now lives in `checkoutVisitsFromRows`
 * (`app/tests/modules/stats/x01-checkout-sessions.module.test.ts`), folded
 * from `turns.total_score` rather than a running dart-score sum. This
 * describe block replaces the deleted one rather than repointing its
 * assertions at a different input.
 */
describe("findX01CheckoutDarts", () => {
  it("returns an empty array when the player has no X01 checkout darts", async () => {
    const db = { select: vi.fn(() => fakeOrderedQuery([])) } as any;
    const { findX01CheckoutDarts } =
      await import("@repositories/statistics.repository");

    const result = await findX01CheckoutDarts(db, "p1");

    expect(result).toEqual([]);
    expect(db.select).toHaveBeenCalledTimes(1);
  });

  it("reads every column from v_x01_checkout_darts, ordered for the fold", async () => {
    const row = {
      sessionId: "s1",
      gameTypeKey: "501",
      rulesetVersionKey: "501_V1",
      configuration: { starting_score: 501 },
      stageId: "stage-1",
      stageSequence: 1,
      stageTypeKey: "LEG",
      parentStageId: null,
      turnId: "turn-1",
      turnSequence: 1,
      turnTotalScore: 60,
      turnCompletedAt: "2026-09-19T10:00:00.000Z",
      participantId: "participant-1",
      dartNumber: 1,
      hitTargetNumber: 20,
      hitZoneKey: "TREBLE",
      score: 60,
    };
    const query = fakeOrderedQuery([row]);
    const db = { select: vi.fn(() => query) } as any;
    const { vX01CheckoutDarts } = await import("@db/schema");
    const { findX01CheckoutDarts } =
      await import("@repositories/statistics.repository");

    const result = await findX01CheckoutDarts(db, "p1");

    expect(result).toEqual([row]);
    expect(query.from).toHaveBeenCalledWith(vX01CheckoutDarts);
    expect(query.orderBy).toHaveBeenCalledTimes(1);
  });

  /**
   * The SQL order is load-bearing, not cosmetic: `checkoutVisitsFromRows`
   * groups by session and folds each session's ladder in the order the rows
   * arrive, and 121/TUOD slice that log by array index.
   *
   * Columns are compared by `uniqueName` (`<view>_<column>_unique`), which
   * names both the view and the column, and is read off the schema objects
   * themselves rather than hardcoded -- so a rename in `schema.ts` flows
   * through and a column from some other table could never satisfy it. Two
   * things rule out the more obvious forms: a Drizzle view proxy mints a
   * fresh column object on every property access, so
   * `vX01CheckoutDarts.sessionId !== vX01CheckoutDarts.sessionId` and `toBe`
   * can never hold; and a column is a cyclic object graph that makes
   * `toEqual`/`toHaveBeenCalledWith` blow the stack.
   */
  it("orders by session, stage sequence, turn sequence and dart number, in that order", async () => {
    const query = fakeOrderedQuery([]);
    const db = { select: vi.fn(() => query) } as any;
    const { vX01CheckoutDarts } = await import("@db/schema");
    const { findX01CheckoutDarts } =
      await import("@repositories/statistics.repository");

    await findX01CheckoutDarts(db, "p1");

    const identityOf = (column: unknown): string | undefined =>
      (column as { uniqueName?: string }).uniqueName;
    const ordered = query.orderBy.mock.calls[0].map(identityOf);

    expect(ordered).toEqual([
      identityOf(vX01CheckoutDarts.sessionId),
      identityOf(vX01CheckoutDarts.stageSequence),
      identityOf(vX01CheckoutDarts.turnSequence),
      identityOf(vX01CheckoutDarts.dartNumber),
    ]);
  });
});

describe("findGameSessionsPage", () => {
  const baseQuery = {
    playerId: "p1",
    gameTypeKey: "501" as const,
    from: "2026-01-01T00:00:00.000Z",
    to: "2026-02-01T00:00:00.000Z",
    statuses: ["COMPLETED", "ABANDONED"],
    context: "all" as const,
    limit: 25,
  };

  it("selects from v_stats_session_facts scoped to the player and game", async () => {
    const { db, statements } = renderingDb([]);
    await findGameSessionsPage(db, baseQuery);
    const sql = onlyStatement(statements);
    expect(sql).toContain('"v_stats_session_facts"');
    expect(sql).toMatch(/"player_id" = \$/);
    expect(sql).toMatch(/"game_type_key" = \$/);
  });

  it("orders by completed_at desc, session_id desc and fetches limit + 1", async () => {
    const { db, statements } = renderingDb([]);
    await findGameSessionsPage(db, baseQuery);
    const sql = onlyStatement(statements);
    expect(sql).toMatch(/order by .*"completed_at" desc.*"session_id" desc/);
    expect(sql).toMatch(/limit \$/);
    expect(statements[0].params).toContain(26);
  });

  it("adds context_key = 'ROUTINE' when context=routine", async () => {
    const { db, statements } = renderingDb([]);
    await findGameSessionsPage(db, { ...baseQuery, context: "routine" });
    const sql = onlyStatement(statements);
    expect(sql).toMatch(/"context_key" = \$/);
    expect(statements[0].params).toContain("ROUTINE");
  });

  it("adds the keyset predicate when a cursor is given", async () => {
    const { db, statements } = renderingDb([]);
    await findGameSessionsPage(db, {
      ...baseQuery,
      after: { completedAt: "2026-01-15T00:00:00.000Z", sessionId: "s1" },
    });
    const sql = onlyStatement(statements);
    expect(sql).toContain("<");
    expect(statements[0].params).toEqual(
      expect.arrayContaining(["2026-01-15T00:00:00.000Z", "s1"]),
    );
  });

  it("marks a turn-free abandoned row as neverStarted", async () => {
    const fromCalls: unknown[] = [];
    const rows = [
      {
        sessionId: "s1",
        rulesetVersionKey: "501_V1",
        statusKey: "ABANDONED",
        contextKey: "STANDALONE",
        startedAt: "2026-01-01T00:00:00.000Z",
        completedAt: "2026-01-01T00:01:00.000Z",
        durationSeconds: 60,
        turnCount: 0,
        dartCount: 0,
        countedScore: 0,
      },
    ];
    const chain = {
      from: vi.fn((table: unknown) => {
        fromCalls.push(table);
        return chain;
      }),
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue(rows),
    };
    const db = { select: vi.fn(() => chain) } as any;
    const { vStatsSessionFacts } = await import("@db/schema");

    const result = await findGameSessionsPage(db, baseQuery);

    expect(fromCalls).toEqual([vStatsSessionFacts]);
    expect(result[0].neverStarted).toBe(true);
  });
});

describe("findGameDataVersion", () => {
  it("selects count and max(completed_at) from v_stats_session_facts", async () => {
    const { db, statements } = renderingDb([["0", null]]);
    await findGameDataVersion(db, "p1", "501");
    const sql = onlyStatement(statements);
    expect(sql).toContain('"v_stats_session_facts"');
    expect(sql).toMatch(/count\(/i);
    expect(sql).toMatch(/max\(/i);
  });

  it("parses count from a string", async () => {
    const chain = {
      from: vi.fn().mockReturnThis(),
      where: vi
        .fn()
        .mockResolvedValue([
          { count: "7", maxCompletedAt: "2026-01-01T00:00:00.000Z" },
        ]),
    };
    const db = { select: vi.fn(() => chain) } as any;

    const result = await findGameDataVersion(db, "p1", "501");

    expect(result).toEqual({
      count: 7,
      maxCompletedAt: "2026-01-01T00:00:00.000Z",
    });
  });
});

describe("findBucketFloor", () => {
  it("renders the widened date_trunc floor for the unit and tz", async () => {
    const { db, statements } = renderingDb([
      { floor: "2026-01-01T00:00:00.000Z" },
    ]);
    await findBucketFloor(
      db,
      "2026-01-15T00:00:00.000Z",
      "month",
      "Europe/Amsterdam",
    );
    const sql = onlyStatement(statements);
    expect(sql).toMatch(/date_trunc\('month', .*AT TIME ZONE \$/);
  });
});

describe("findBucketedSessionAggregates", () => {
  const baseQuery = {
    playerId: "p1",
    gameTypeKey: "501" as const,
    from: "2026-01-01T00:00:00.000Z",
    to: "2026-02-01T00:00:00.000Z",
    bucket: "month" as const,
    tz: "Europe/Amsterdam",
    statuses: ["COMPLETED"],
    context: "all" as const,
  };

  it("selects from v_stats_session_facts", async () => {
    const { db, statements } = renderingDb([]);
    await findBucketedSessionAggregates(db, baseQuery);
    const sql = onlyStatement(statements);
    expect(sql).toContain('"v_stats_session_facts"');
  });

  it("renders date_trunc('month', … AT TIME ZONE $n) for the bucket expression", async () => {
    const { db, statements } = renderingDb([]);
    await findBucketedSessionAggregates(db, baseQuery);
    const sql = onlyStatement(statements);
    expect(sql).toMatch(/date_trunc\('month', .*AT TIME ZONE \$/);
  });

  it("adds context_key = 'ROUTINE' when context=routine", async () => {
    const { db, statements } = renderingDb([]);
    await findBucketedSessionAggregates(db, {
      ...baseQuery,
      context: "routine",
    });
    const sql = onlyStatement(statements);
    expect(sql).toMatch(/"context_key" = \$/);
    expect(statements[0].params).toContain("ROUTINE");
  });

  function fakeGroupedSelect(rows: unknown[]) {
    return {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      groupBy: vi.fn().mockResolvedValue(rows),
    };
  }

  it("groups with no bucket expression and returns bucket_start=from, bucket_end=to when bucket=none", async () => {
    const chain = fakeGroupedSelect([
      {
        bucketStart: baseQuery.from,
        bucketEnd: baseQuery.to,
        statusKey: "COMPLETED",
        contextKey: "STANDALONE",
        rulesetVersionKey: "501_V1",
        neverStarted: false,
        sessions: "3",
        turnSum: "30",
        dartSum: "90",
        durationSum: "900",
        scoreSum: "1500",
        scoreMin: "400",
        scoreMax: "600",
        minSessionId: "s1",
        maxSessionId: "s2",
      },
    ]);
    const db = { select: vi.fn(() => chain) } as any;

    const result = await findBucketedSessionAggregates(db, {
      ...baseQuery,
      bucket: "none",
      tz: undefined,
    });

    expect(result[0].bucketStart).toBe(baseQuery.from);
    expect(result[0].bucketEnd).toBe(baseQuery.to);
    expect(result[0].sessions).toBe(3);
  });

  it("nonNull throws on a null status_key", async () => {
    const chain = fakeGroupedSelect([
      {
        statusKey: null,
        contextKey: "STANDALONE",
        rulesetVersionKey: "501_V1",
        neverStarted: false,
        sessions: "1",
        turnSum: "1",
        dartSum: "1",
        durationSum: "1",
        scoreSum: "1",
        scoreMin: "1",
        scoreMax: "1",
        minSessionId: "s1",
        maxSessionId: "s1",
      },
    ]);
    const db = { select: vi.fn(() => chain) } as any;

    await expect(
      findBucketedSessionAggregates(db, {
        ...baseQuery,
        bucket: "none",
        tz: undefined,
      }),
    ).rejects.toThrow(/status_key/);
  });
});

const dartScope = {
  playerId: "p1",
  gameTypeKey: "DOUBLES_TRAINING" as const,
  from: "2026-01-01T00:00:00.000Z",
  to: "2026-02-01T00:00:00.000Z",
  statuses: ["COMPLETED"],
  context: "all" as const,
};

describe("findIntentCells", () => {
  it("selects from v_stats_dart_facts", async () => {
    const { db, statements } = renderingDb([]);
    await findIntentCells(db, { ...dartScope, bucket: "none", tz: undefined });
    const sql = onlyStatement(statements);
    expect(sql).toContain('"v_stats_dart_facts"');
  });

  it("adds context_key = 'STANDALONE' when context=standalone", async () => {
    const { db, statements } = renderingDb([]);
    await findIntentCells(db, {
      ...dartScope,
      context: "standalone",
      bucket: "none",
      tz: undefined,
    });
    const sql = onlyStatement(statements);
    expect(sql).toMatch(/"context_key" = \$/);
    expect(statements[0].params).toContain("STANDALONE");
  });

  it("filters to intended_zone_key IS NOT NULL", async () => {
    const { db, statements } = renderingDb([]);
    await findIntentCells(db, { ...dartScope, bucket: "none", tz: undefined });
    const sql = onlyStatement(statements);
    expect(sql).toContain('"intended_zone_key" is not null');
  });

  it("renders the bucket expression on bucket=month", async () => {
    const { db, statements } = renderingDb([]);
    await findIntentCells(db, {
      ...dartScope,
      bucket: "month",
      tz: "Europe/Amsterdam",
    });
    const sql = onlyStatement(statements);
    expect(sql).toMatch(/date_trunc\('month', .*AT TIME ZONE \$/);
  });

  it("parses darts from a string count", async () => {
    const chain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      groupBy: vi.fn().mockResolvedValue([
        {
          bucketStart: dartScope.from,
          bucketEnd: dartScope.to,
          intendedTargetNumber: 16,
          intendedZoneKey: "DOUBLE",
          hitTargetNumber: 16,
          hitZoneKey: "DOUBLE",
          darts: "3",
        },
      ]),
    };
    const db = { select: vi.fn(() => chain) } as any;

    const result = await findIntentCells(db, {
      ...dartScope,
      bucket: "none",
      tz: undefined,
    });

    expect(result[0].darts).toBe(3);
  });

  it("nonNull throws on a null intended_zone_key row", async () => {
    const chain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      groupBy: vi.fn().mockResolvedValue([
        {
          bucketStart: dartScope.from,
          bucketEnd: dartScope.to,
          intendedTargetNumber: 16,
          intendedZoneKey: null,
          hitTargetNumber: 16,
          hitZoneKey: "DOUBLE",
          darts: "1",
        },
      ]),
    };
    const db = { select: vi.fn(() => chain) } as any;

    await expect(
      findIntentCells(db, { ...dartScope, bucket: "none", tz: undefined }),
    ).rejects.toThrow(/intended_zone_key/);
  });
});

describe("findIntentMoments", () => {
  it("selects from v_stats_dart_facts and filters intended_zone_key IS NOT NULL", async () => {
    const { db, statements } = renderingDb([]);
    await findIntentMoments(db, {
      ...dartScope,
      bucket: "none",
      tz: undefined,
    });
    const sql = onlyStatement(statements);
    expect(sql).toContain('"v_stats_dart_facts"');
    expect(sql).toContain('"intended_zone_key" is not null');
  });

  it("parses the moment sums from strings", async () => {
    const chain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      groupBy: vi.fn().mockResolvedValue([
        {
          bucketStart: dartScope.from,
          bucketEnd: dartScope.to,
          intendedTargetNumber: 16,
          intendedZoneKey: "DOUBLE",
          n: "4",
          sumX: "10.5",
          sumY: "-8.25",
          sumXX: "44.5",
          sumYY: "30.25",
          sumXY: "-12.5",
        },
      ]),
    };
    const db = { select: vi.fn(() => chain) } as any;

    const result = await findIntentMoments(db, {
      ...dartScope,
      bucket: "none",
      tz: undefined,
    });

    expect(result[0]).toMatchObject({
      n: 4,
      sumX: 10.5,
      sumY: -8.25,
      sumXX: 44.5,
      sumYY: 30.25,
      sumXY: -12.5,
    });
  });
});

describe("findMissSectors", () => {
  const refs = [
    {
      targetNumber: 16,
      zoneKey: "DOUBLE",
      cx: 0,
      cy: -162,
      rInner: 162,
      rOuter: 170,
    },
  ];

  it("selects from v_stats_dart_facts", async () => {
    const { db, statements } = renderingDb([]);
    await findMissSectors(db, { ...dartScope, refs });
    const sql = onlyStatement(statements);
    expect(sql).toContain('"v_stats_dart_facts"');
  });

  it("binds every reference value as a parameter, never a literal", async () => {
    const { db, statements } = renderingDb([]);
    await findMissSectors(db, { ...dartScope, refs });
    const sql = onlyStatement(statements);
    expect(sql).not.toContain("162");
    expect(statements[0].params).toContain(162);
    expect(statements[0].params).toContain(170);
  });

  it("excludes darts that hit the intended target", async () => {
    const { db, statements } = renderingDb([]);
    await findMissSectors(db, { ...dartScope, refs });
    const sql = onlyStatement(statements);
    expect(sql).toMatch(/NOT \(/);
    expect(sql).toContain("IS NOT DISTINCT FROM");
  });
});

const sessionScope = {
  playerId: "p1",
  gameTypeKey: "501" as const,
  from: "2026-01-01T00:00:00.000Z",
  to: "2026-02-01T00:00:00.000Z",
  statuses: ["COMPLETED"],
  context: "all" as const,
};

describe("findScopeDartCount", () => {
  it("selects the dart-count sum from v_stats_session_facts, scoped to VISUAL_BOARD", async () => {
    const { db, statements } = renderingDb([["0"]]);
    await findScopeDartCount(db, sessionScope);
    const sql = onlyStatement(statements);
    expect(sql).toContain('"v_stats_session_facts"');
    expect(sql).toMatch(/"player_id" = \$/);
    expect(sql).toMatch(/"game_type_key" = \$/);
    expect(sql).toMatch(/"input_mode_key" = \$/);
    expect(statements[0].params).toContain("VISUAL_BOARD");
  });

  it("returns 0 for an empty scope", async () => {
    const chain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue([{ dartCount: "0" }]),
    };
    const db = { select: vi.fn(() => chain) } as any;

    const result = await findScopeDartCount(db, sessionScope);

    expect(result).toBe(0);
  });

  it("parses the sum from a string", async () => {
    const chain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue([{ dartCount: "12345" }]),
    };
    const db = { select: vi.fn(() => chain) } as any;

    const result = await findScopeDartCount(db, sessionScope);

    expect(result).toBe(12345);
  });
});

describe("findX01FoldRows", () => {
  it("reads v_x01_checkout_darts joined to v_stats_session_facts, filtering status_key and completed_at", async () => {
    const { db, statements } = renderingDb([]);
    await findX01FoldRows(db, {
      ...sessionScope,
      bucket: "none",
      tz: undefined,
    });
    const sql = onlyStatement(statements);
    expect(sql).toContain('"v_x01_checkout_darts"');
    expect(sql).toContain('"v_stats_session_facts"');
    expect(sql).toMatch(/"status_key"/);
    expect(sql).toMatch(/"completed_at" >= \$/);
    expect(sql).toMatch(/"completed_at" < \$/);
  });

  it("orders by session, stage sequence, turn sequence and dart number, in that order", async () => {
    const { db, statements } = renderingDb([]);
    await findX01FoldRows(db, {
      ...sessionScope,
      bucket: "none",
      tz: undefined,
    });
    const sql = onlyStatement(statements);
    const orderIndex = sql.toLowerCase().indexOf("order by");
    expect(orderIndex).toBeGreaterThan(-1);
    const orderClause = sql.slice(orderIndex);
    expect(orderClause).toMatch(
      /"session_id".*"stage_sequence".*"turn_sequence".*"dart_number"/,
    );
  });

  it("renders the bucket expression on bucket=month", async () => {
    const { db, statements } = renderingDb([]);
    await findX01FoldRows(db, {
      ...sessionScope,
      bucket: "month",
      tz: "Europe/Amsterdam",
    });
    const sql = onlyStatement(statements);
    expect(sql).toMatch(/date_trunc\('month', .*AT TIME ZONE \$/);
  });

  it("returns rows carrying every v_x01_checkout_darts column plus the bucket bounds", async () => {
    const row = {
      sessionId: "s1",
      gameTypeKey: "501",
      rulesetVersionKey: "501_V1",
      configuration: { starting_score: 501 },
      stageId: "stage-1",
      stageSequence: 1,
      stageTypeKey: "LEG",
      parentStageId: null,
      turnId: "turn-1",
      turnSequence: 1,
      turnTotalScore: 60,
      turnCompletedAt: "2026-09-19T10:00:00.000Z",
      participantId: "participant-1",
      dartNumber: 1,
      hitTargetNumber: 20,
      hitZoneKey: "TREBLE",
      score: 60,
      bucketStart: "2026-01-01T00:00:00.000Z",
      bucketEnd: "2026-02-01T00:00:00.000Z",
    };
    const chain = {
      from: vi.fn().mockReturnThis(),
      innerJoin: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockResolvedValue([row]),
    };
    const db = { select: vi.fn(() => chain) } as any;

    const result = await findX01FoldRows(db, {
      ...sessionScope,
      bucket: "none",
      tz: undefined,
    });

    expect(result).toEqual([row]);
  });
});

describe("findDartFoldRows", () => {
  it("reads v_stats_dart_facts joined to v_stats_session_facts, filtering status_key and completed_at", async () => {
    const { db, statements } = renderingDb([]);
    await findDartFoldRows(db, {
      ...sessionScope,
      bucket: "none",
      tz: undefined,
    });
    const sql = onlyStatement(statements);
    expect(sql).toContain('"v_stats_dart_facts"');
    expect(sql).toContain('"v_stats_session_facts"');
    expect(sql).toMatch(/"status_key"/);
    expect(sql).toMatch(/"completed_at" >= \$/);
    expect(sql).toMatch(/"completed_at" < \$/);
  });

  it("orders by session, turn sequence and dart number, in that order", async () => {
    const { db, statements } = renderingDb([]);
    await findDartFoldRows(db, {
      ...sessionScope,
      bucket: "none",
      tz: undefined,
    });
    const sql = onlyStatement(statements);
    const orderIndex = sql.toLowerCase().indexOf("order by");
    expect(orderIndex).toBeGreaterThan(-1);
    const orderClause = sql.slice(orderIndex);
    expect(orderClause).toMatch(/"session_id".*"turn_sequence".*"dart_number"/);
  });

  it("renders the bucket expression on bucket=month", async () => {
    const { db, statements } = renderingDb([]);
    await findDartFoldRows(db, {
      ...sessionScope,
      bucket: "month",
      tz: "Europe/Amsterdam",
    });
    const sql = onlyStatement(statements);
    expect(sql).toMatch(/date_trunc\('month', .*AT TIME ZONE \$/);
  });

  it("maps configuration untouched", async () => {
    const configuration = { difficulty: "HARD", segment_rule: "OUTER_SINGLE" };
    const chain = {
      from: vi.fn().mockReturnThis(),
      innerJoin: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockResolvedValue([
        {
          sessionId: "s1",
          gameTypeKey: "AROUND_THE_CLOCK",
          rulesetVersionKey: "AROUND_THE_CLOCK_V2",
          configuration,
          sessionDartCount: 1,
          bucketStart: sessionScope.from,
          bucketEnd: sessionScope.to,
          turnSequence: 1,
          dartNumber: 1,
          hitTargetNumber: 1,
          hitZoneKey: "OUTER_SINGLE",
          intendedTargetNumber: null,
          intendedZoneKey: null,
          locationX: "12.34",
          locationY: "-5.60",
        },
      ]),
    };
    const db = { select: vi.fn(() => chain) } as any;

    const result = await findDartFoldRows(db, {
      ...sessionScope,
      bucket: "none",
      tz: undefined,
    });

    expect(result[0].configuration).toBe(configuration);
  });

  it("converts the NUMERIC location_x/location_y columns to numbers", async () => {
    const chain = {
      from: vi.fn().mockReturnThis(),
      innerJoin: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockResolvedValue([
        {
          sessionId: "s1",
          gameTypeKey: "SINGLES_TRAINING",
          rulesetVersionKey: "SINGLES_V1",
          configuration: {},
          sessionDartCount: 1,
          bucketStart: sessionScope.from,
          bucketEnd: sessionScope.to,
          turnSequence: 1,
          dartNumber: 1,
          hitTargetNumber: 7,
          hitZoneKey: "OUTER_SINGLE",
          intendedTargetNumber: null,
          intendedZoneKey: null,
          locationX: "12.34",
          locationY: "-5.60",
        },
      ]),
    };
    const db = { select: vi.fn(() => chain) } as any;

    const result = await findDartFoldRows(db, {
      ...sessionScope,
      bucket: "none",
      tz: undefined,
    });

    expect(result[0].locationX).toBe(12.34);
    expect(result[0].locationY).toBe(-5.6);
  });

  it("nonNull throws on a null turn_sequence", async () => {
    const chain = {
      from: vi.fn().mockReturnThis(),
      innerJoin: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockResolvedValue([
        {
          sessionId: "s1",
          gameTypeKey: "SINGLES_TRAINING",
          rulesetVersionKey: "SINGLES_V1",
          configuration: {},
          sessionDartCount: 1,
          bucketStart: sessionScope.from,
          bucketEnd: sessionScope.to,
          turnSequence: null,
          dartNumber: 1,
          hitTargetNumber: 7,
          hitZoneKey: "OUTER_SINGLE",
          intendedTargetNumber: null,
          intendedZoneKey: null,
          locationX: "12.34",
          locationY: "-5.60",
        },
      ]),
    };
    const db = { select: vi.fn(() => chain) } as any;

    await expect(
      findDartFoldRows(db, { ...sessionScope, bucket: "none", tz: undefined }),
    ).rejects.toThrow(/turn_sequence/);
  });
});

describe("findVisitScoring", () => {
  const bands = [100, 140, 180] as const;

  it("selects from v_player_visit_facts joined to v_stats_session_facts", async () => {
    const { db, statements } = renderingDb([]);
    await findVisitScoring(db, {
      ...sessionScope,
      bucket: "none",
      tz: undefined,
      bands,
    });
    const sql = onlyStatement(statements);
    expect(sql).toContain('"v_player_visit_facts"');
    expect(sql).toContain('"v_stats_session_facts"');
  });

  it("coalesces points and darts to 0 so an empty bucket=none scope does not yield null sums", async () => {
    const { db, statements } = renderingDb([]);
    await findVisitScoring(db, {
      ...sessionScope,
      bucket: "none",
      tz: undefined,
      bands,
    });
    const sql = onlyStatement(statements);
    expect(sql).toMatch(
      /coalesce\(sum\("v_player_visit_facts"\."total_score"\), 0\)/,
    );
    expect(sql).toMatch(
      /coalesce\(sum\("v_player_visit_facts"\."dart_count"\), 0\)/,
    );
  });

  it("binds all three band edges as parameters, with no literal 140 in the rendered SQL", async () => {
    const { db, statements } = renderingDb([]);
    await findVisitScoring(db, {
      ...sessionScope,
      bucket: "month",
      tz: "Europe/Amsterdam",
      bands,
    });
    const sql = onlyStatement(statements);
    expect(sql).not.toContain("140");
    expect(statements[0].params).toEqual(
      expect.arrayContaining([100, 140, 180]),
    );
  });

  it("filters the first-nine sums to LEG stages at turn_sequence <= 3", async () => {
    const { db, statements } = renderingDb([]);
    await findVisitScoring(db, {
      ...sessionScope,
      bucket: "none",
      tz: undefined,
      bands,
    });
    const sql = onlyStatement(statements);
    expect(sql).toMatch(/filter \(where .*'LEG'.*<= 3\)/i);
  });

  it("parses every sum from a string", async () => {
    const chain = {
      from: vi.fn().mockReturnThis(),
      innerJoin: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue([
        {
          bucketStart: sessionScope.from,
          bucketEnd: sessionScope.to,
          points: "180",
          darts: "9",
          firstNinePoints: "180",
          firstNineDarts: "9",
          ton: "1",
          tonForty: "0",
          oneEighty: "1",
        },
      ]),
    };
    const db = { select: vi.fn(() => chain) } as any;

    const result = await findVisitScoring(db, {
      ...sessionScope,
      bucket: "none",
      tz: undefined,
      bands,
    });

    expect(result).toEqual([
      {
        bucketStart: sessionScope.from,
        bucketEnd: sessionScope.to,
        points: 180,
        darts: 9,
        firstNinePoints: 180,
        firstNineDarts: 9,
        ton: 1,
        tonForty: 0,
        oneEighty: 1,
      },
    ]);
  });
});

describe("findHitNumberCells", () => {
  it("uses dartScopeWhere: selects from v_stats_dart_facts and adds context_key when context is not 'all'", async () => {
    const { db, statements } = renderingDb([]);
    await findHitNumberCells(db, {
      ...dartScope,
      context: "standalone",
      bucket: "none",
      tz: undefined,
    });
    const sql = onlyStatement(statements);
    expect(sql).toContain('"v_stats_dart_facts"');
    expect(sql).toMatch(/"context_key" = \$/);
    expect(statements[0].params).toContain("STANDALONE");
  });

  it("groups by hit number, coalescing a null hit_target_number to 'MISS'", async () => {
    const { db, statements } = renderingDb([]);
    await findHitNumberCells(db, {
      ...dartScope,
      bucket: "none",
      tz: undefined,
    });
    const sql = onlyStatement(statements);
    expect(sql).toMatch(/coalesce\(.*'MISS'\)/i);
  });

  it("counts trebles via a FILTER on hit_zone_key = 'TREBLE'", async () => {
    const { db, statements } = renderingDb([]);
    await findHitNumberCells(db, {
      ...dartScope,
      bucket: "none",
      tz: undefined,
    });
    const sql = onlyStatement(statements);
    expect(sql).toMatch(/filter \(where .*'TREBLE'\)/i);
  });

  it("renders the bucket expression on bucket=week", async () => {
    const { db, statements } = renderingDb([]);
    await findHitNumberCells(db, {
      ...dartScope,
      bucket: "week",
      tz: "Europe/Amsterdam",
    });
    const sql = onlyStatement(statements);
    expect(sql).toMatch(/date_trunc\('week', .*AT TIME ZONE \$/);
  });

  it("parses darts and trebles from string counts", async () => {
    const chain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      groupBy: vi.fn().mockResolvedValue([
        {
          bucketStart: dartScope.from,
          bucketEnd: dartScope.to,
          hitNumber: "20",
          darts: "10",
          trebles: "3",
        },
      ]),
    };
    const db = { select: vi.fn(() => chain) } as any;

    const result = await findHitNumberCells(db, {
      ...dartScope,
      bucket: "none",
      tz: undefined,
    });

    expect(result).toEqual([
      {
        bucketStart: dartScope.from,
        bucketEnd: dartScope.to,
        hitNumber: "20",
        darts: 10,
        trebles: 3,
      },
    ]);
  });
});

describe("findHeatmapCells", () => {
  it("selects from v_stats_dart_facts", async () => {
    const { db, statements } = renderingDb([]);
    await findHeatmapCells(db, { ...dartScope, cellMm: 5, target: null });
    const sql = onlyStatement(statements);
    expect(sql).toContain('"v_stats_dart_facts"');
  });

  it("binds both the target number and zone when a target is set", async () => {
    const { db, statements } = renderingDb([]);
    await findHeatmapCells(db, {
      ...dartScope,
      cellMm: 5,
      target: { number: 16, zone: "DOUBLE" },
    });
    const sql = onlyStatement(statements);
    expect(sql).toMatch(/"intended_target_number" = \$/);
    expect(sql).toMatch(/"intended_zone_key" = \$/);
    expect(statements[0].params).toContain(16);
    expect(statements[0].params).toContain("DOUBLE");
  });

  it("omits the target filter when target is null", async () => {
    const { db, statements } = renderingDb([]);
    await findHeatmapCells(db, { ...dartScope, cellMm: 5, target: null });
    const sql = onlyStatement(statements);
    expect(sql).not.toContain("intended_target_number");
  });
});

function fakeSelectDistinct(rows: unknown[]) {
  const fromCalls: unknown[] = [];
  const chain = {
    from: vi.fn((table: unknown) => {
      fromCalls.push(table);
      return chain;
    }),
    where: vi.fn().mockResolvedValue(rows),
  };
  return { chain, fromCalls };
}

/**
 * `findReplaySession`'s query chain (R6): `from`/`where`/`limit` plus a
 * `leftJoin`, since the primary query joins `v_stats_routine_step_facts`.
 * `resolutions` queues each call's `limit()` result in order, so a test can
 * serve the join query's rows, then the fallback step-view query's, off
 * the one chain `db.select` keeps returning.
 */
function fakeReplayQuery(...resolutions: unknown[][]) {
  const limit = vi.fn();
  resolutions.forEach((rows) => limit.mockResolvedValueOnce(rows));
  return {
    from: vi.fn().mockReturnThis(),
    leftJoin: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit,
  };
}

const GAME_JOIN_ROW = {
  sessionId: "s1",
  gameTypeKey: "501",
  rulesetVersionKey: "501_V1",
  inputModeKey: "VISUAL_BOARD",
  statusKey: "COMPLETED",
  contextKey: "STANDALONE",
  activityId: "activity-1",
  routineStepSequenceNumber: null,
  configuration: null,
  startedAt: "2026-09-19T10:00:00.000Z",
  completedAt: "2026-09-19T10:05:00.000Z",
  durationSeconds: 300,
  turnCount: 9,
  dartCount: 27,
  exerciseTypeKey: null,
  exerciseRulesetVersionKey: null,
  routineKey: null,
  stepKey: null,
};

describe("findReplaySession", () => {
  it("selects from v_stats_session_facts, left-joined to v_stats_routine_step_facts, filtered by player and session", async () => {
    const { db, statements } = renderingDb([]);
    await findReplaySession(db, "p1", "s1");
    const sql = statements[0]!.sql;
    expect(sql).toContain('"v_stats_session_facts"');
    expect(sql).toContain('"v_stats_routine_step_facts"');
    expect(sql).toMatch(/"player_id" = \$/);
    expect(sql).toMatch(/"session_id" = \$/);
  });

  it("falls back to v_stats_routine_step_facts, filtered by player, session and a non-null input mode, when the join misses", async () => {
    const { db, statements } = renderingDb([]);
    const result = await findReplaySession(db, "p1", "s1");
    expect(statements).toHaveLength(2);
    const sql = statements[1]!.sql;
    expect(sql).toContain('"v_stats_routine_step_facts"');
    expect(sql).toMatch(/"player_id" = \$/);
    expect(sql).toMatch(/"session_id" = \$/);
    expect(sql.toLowerCase()).toMatch(/"input_mode_key" is not null/);
    expect(result).toBeNull();
  });

  it("returns null when neither query matches", async () => {
    const chain = fakeReplayQuery([], []);
    const db = { select: vi.fn(() => chain) } as any;

    const result = await findReplaySession(db, "p1", "s1");

    expect(result).toBeNull();
  });

  it("maps the decision 5 fields for a standalone game, defaulting exerciseTypeKey to GAME (R6) when the join finds no step", async () => {
    const configuration = { starting_score: 501 };
    const row = { ...GAME_JOIN_ROW, configuration };
    const db = { select: vi.fn(() => fakeReplayQuery([row])) } as any;

    const result = await findReplaySession(db, "p1", "s1");

    expect(result).toEqual({
      sessionId: "s1",
      gameTypeKey: "501",
      rulesetVersionKey: "501_V1",
      inputModeKey: "VISUAL_BOARD",
      statusKey: "COMPLETED",
      contextKey: "STANDALONE",
      activityId: "activity-1",
      routineStepSequenceNumber: null,
      configuration,
      startedAt: "2026-09-19T10:00:00.000Z",
      completedAt: "2026-09-19T10:05:00.000Z",
      durationSeconds: 300,
      turnCount: 9,
      dartCount: 27,
      exerciseTypeKey: "GAME",
      exerciseRulesetVersionKey: null,
      routineKey: null,
      stepKey: null,
    });
    expect(result?.configuration).toBe(configuration);
  });

  it("carries routineKey, stepKey, exerciseTypeKey and exerciseRulesetVersionKey through for a GAME routine step (R6)", async () => {
    const row = {
      ...GAME_JOIN_ROW,
      routineStepSequenceNumber: 2,
      contextKey: "ROUTINE",
      exerciseTypeKey: "GAME",
      exerciseRulesetVersionKey: null,
      routineKey: "name-abc123",
      stepKey: "1-def456",
    };
    const db = { select: vi.fn(() => fakeReplayQuery([row])) } as any;

    const result = await findReplaySession(db, "p1", "s1");

    expect(result?.routineKey).toBe("name-abc123");
    expect(result?.stepKey).toBe("1-def456");
    expect(result?.exerciseTypeKey).toBe("GAME");
    expect(result?.routineStepSequenceNumber).toBe(2);
  });

  it("nonNull throws on a null activityId column", async () => {
    const row = { ...GAME_JOIN_ROW, activityId: null };
    const db = { select: vi.fn(() => fakeReplayQuery([row])) } as any;

    await expect(findReplaySession(db, "p1", "s1")).rejects.toThrow(
      /activity_id/,
    );
  });

  it("falls back to the step view and maps decision 11 fields for a non-game step (Switching)", async () => {
    const configuration = { targets: [20, 19] };
    const stepRow = {
      sessionId: "s2",
      activityId: "activity-2",
      routineKey: "name-abc123",
      stepKey: "1-def456",
      sequenceNumber: 1,
      exerciseTypeKey: "SWITCHING",
      exerciseRulesetVersionKey: "SWITCHING_V1",
      gameTypeKey: null,
      rulesetVersionKey: null,
      inputModeKey: "VISUAL_BOARD",
      statusKey: "COMPLETED",
      configuration,
      startedAt: "2026-09-19T10:00:00.000Z",
      completedAt: "2026-09-19T10:05:00.000Z",
      durationSeconds: 300,
      turnCount: 5,
      dartCount: 15,
    };
    const chain = fakeReplayQuery([], [stepRow]);
    const db = { select: vi.fn(() => chain) } as any;

    const result = await findReplaySession(db, "p1", "s2");

    expect(result).toEqual({
      sessionId: "s2",
      gameTypeKey: null,
      rulesetVersionKey: null,
      inputModeKey: "VISUAL_BOARD",
      statusKey: "COMPLETED",
      contextKey: "ROUTINE",
      activityId: "activity-2",
      routineStepSequenceNumber: 1,
      configuration,
      startedAt: "2026-09-19T10:00:00.000Z",
      completedAt: "2026-09-19T10:05:00.000Z",
      durationSeconds: 300,
      turnCount: 5,
      dartCount: 15,
      exerciseTypeKey: "SWITCHING",
      exerciseRulesetVersionKey: "SWITCHING_V1",
      routineKey: "name-abc123",
      stepKey: "1-def456",
    });
  });

  it("nonNull throws on a null statusKey column from the step-view fallback", async () => {
    const stepRow = {
      sessionId: "s2",
      activityId: "activity-2",
      routineKey: "name-abc123",
      stepKey: "1-def456",
      sequenceNumber: 1,
      exerciseTypeKey: "SWITCHING",
      exerciseRulesetVersionKey: "SWITCHING_V1",
      gameTypeKey: null,
      rulesetVersionKey: null,
      inputModeKey: "VISUAL_BOARD",
      statusKey: null,
      configuration: null,
      startedAt: "2026-09-19T10:00:00.000Z",
      completedAt: "2026-09-19T10:05:00.000Z",
      durationSeconds: 300,
      turnCount: 5,
      dartCount: 15,
    };
    const chain = fakeReplayQuery([], [stepRow]);
    const db = { select: vi.fn(() => chain) } as any;

    await expect(findReplaySession(db, "p1", "s2")).rejects.toThrow(
      /status_key/,
    );
  });
});

describe("findReplayStages", () => {
  it("selects distinct stage columns from v_game_replay filtered by player and session", async () => {
    const { db, statements } = renderingDb([]);
    await findReplayStages(db, "p1", "s1");
    const sql = onlyStatement(statements);
    expect(sql.toLowerCase()).toContain("distinct");
    expect(sql).toContain('"v_game_replay"');
    expect(sql).toMatch(/"player_id" = \$/);
    expect(sql).toMatch(/"session_id" = \$/);
  });

  it("maps stage_sequence to sequence, passing parentStageId through", async () => {
    const row = {
      stageId: "stage-1",
      parentStageId: null,
      stageTypeKey: "LEG",
      sequence: 1,
    };
    const { chain, fromCalls } = fakeSelectDistinct([row]);
    const db = { selectDistinct: vi.fn(() => chain) } as any;
    const { vGameReplay } = await import("@db/schema");

    const result = await findReplayStages(db, "p1", "s1");

    expect(result).toEqual([row]);
    expect(fromCalls).toEqual([vGameReplay]);
  });

  it("nonNull throws on a null stage_id column", async () => {
    const { chain } = fakeSelectDistinct([
      {
        stageId: null,
        parentStageId: null,
        stageTypeKey: "LEG",
        sequence: 1,
      },
    ]);
    const db = { selectDistinct: vi.fn(() => chain) } as any;

    await expect(findReplayStages(db, "p1", "s1")).rejects.toThrow(/stage_id/);
  });
});

describe("findReplayParticipants", () => {
  const stageIds = ["stage-1", "stage-2"];

  it("selects from v_game_replay filtered by player and session", async () => {
    const { db, statements } = renderingDb([]);
    await findReplayParticipants(db, "p1", "s1", stageIds);
    const sql = onlyStatement(statements);
    expect(sql).toContain('"v_game_replay"');
    expect(sql).toMatch(/"player_id" = \$/);
    expect(sql).toMatch(/"session_id" = \$/);
  });

  it("ranks each participant's first appearance with array_position cast to uuid[], bound as one parameter", async () => {
    const { db, statements } = renderingDb([]);
    await findReplayParticipants(db, "p1", "s1", stageIds);
    const sql = onlyStatement(statements);
    expect(sql).toMatch(
      /array_position\(\$\d+::uuid\[\], "v_game_replay"\."stage_id"\)/,
    );
    expect(statements[0].params).toContainEqual(stageIds);
  });

  it("uses DISTINCT ON participant_id, ordered by array_position then turn_sequence", async () => {
    const { db, statements } = renderingDb([]);
    await findReplayParticipants(db, "p1", "s1", stageIds);
    const sql = onlyStatement(statements);
    expect(sql.toLowerCase()).toMatch(
      /distinct on \("v_game_replay"\."participant_id"\)/,
    );
    expect(sql).toMatch(
      /order by "v_game_replay"\."participant_id", pos, turn_sequence/i,
    );
  });

  it("maps participant rows, throwing on a null participant_id", async () => {
    const db = {
      execute: vi.fn().mockResolvedValue({
        rows: [
          {
            participant_id: null,
            participant_name: "Alex",
            participant_type_key: "PLAYER",
          },
        ],
      }),
    } as any;

    await expect(
      findReplayParticipants(db, "p1", "s1", stageIds),
    ).rejects.toThrow(/participant_id/);
  });

  it("maps a participant row to participantId/displayName/participantTypeKey", async () => {
    const db = {
      execute: vi.fn().mockResolvedValue({
        rows: [
          {
            participant_id: "participant-1",
            participant_name: "Alex",
            participant_type_key: "PLAYER",
          },
        ],
      }),
    } as any;

    const result = await findReplayParticipants(db, "p1", "s1", stageIds);

    expect(result).toEqual([
      {
        participantId: "participant-1",
        displayName: "Alex",
        participantTypeKey: "PLAYER",
      },
    ]);
  });
});

describe("findReplayTurnPage", () => {
  const stageIds = ["stage-1", "stage-2"];
  const baseQuery = {
    playerId: "p1",
    sessionId: "s1",
    stageIds,
    after: null as { position: number; turnSequence: number } | null,
    limit: 30,
  };

  it("selects from v_game_replay filtered by player and session", async () => {
    const { db, statements } = renderingDb([]);
    await findReplayTurnPage(db, baseQuery);
    const sql = onlyStatement(statements);
    expect(sql).toContain('"v_game_replay"');
    expect(sql).toMatch(/"player_id" = \$/);
    expect(sql).toMatch(/"session_id" = \$/);
  });

  it("ranks turns with dense_rank over array_position and turn_sequence, casting stageIds to uuid[]", async () => {
    const { db, statements } = renderingDb([]);
    await findReplayTurnPage(db, baseQuery);
    const sql = onlyStatement(statements);
    expect(sql).toMatch(
      /dense_rank\(\) over \(order by array_position\(\$\d+::uuid\[\], "v_game_replay"\."stage_id"\), "v_game_replay"\."turn_sequence"\)/i,
    );
    expect(statements[0].params).toContainEqual(stageIds);
  });

  it("keeps turn_rank <= limit + 1", async () => {
    const { db, statements } = renderingDb([]);
    await findReplayTurnPage(db, baseQuery);
    const sql = onlyStatement(statements);
    expect(sql).toMatch(/turn_rank <= \$/);
    expect(statements[0].params).toContain(31);
  });

  it("orders the final page by pos, turn_sequence, dart_number", async () => {
    const { db, statements } = renderingDb([]);
    await findReplayTurnPage(db, baseQuery);
    const sql = onlyStatement(statements);
    const orderIndex = sql.toLowerCase().lastIndexOf("order by");
    expect(orderIndex).toBeGreaterThan(-1);
    expect(sql.slice(orderIndex)).toMatch(
      /order by pos, turn_sequence, dart_number/i,
    );
  });

  it("renders no keyset predicate when after is null", async () => {
    const { db, statements } = renderingDb([]);
    await findReplayTurnPage(db, baseQuery);
    const sql = onlyStatement(statements);
    expect(sql).not.toMatch(/turn_sequence"\)\s*>\s*\(/i);
  });

  it("adds the row-comparison keyset predicate inside the ranked subquery when after is set", async () => {
    const { db, statements } = renderingDb([]);
    await findReplayTurnPage(db, {
      ...baseQuery,
      after: { position: 2, turnSequence: 5 },
    });
    const sql = onlyStatement(statements);
    expect(sql).toMatch(
      /array_position\(\$\d+::uuid\[\], "v_game_replay"\."stage_id"\), "v_game_replay"\."turn_sequence"\)\s*>\s*\(\$\d+, \$\d+\)/i,
    );
    expect(statements[0].params).toContain(2);
    expect(statements[0].params).toContain(5);
  });

  it("converts NUMERIC location_x/location_y strings to numbers, keeping null coordinates null", async () => {
    const db = {
      execute: vi.fn().mockResolvedValue({
        rows: [
          {
            stage_id: "stage-1",
            turn_sequence: 1,
            participant_id: "participant-1",
            participant_name: "Alex",
            participant_type_key: "PLAYER",
            turn_total_score: 60,
            dart_number: 1,
            intended_target_number: 20,
            intended_zone_key: "TREBLE",
            hit_target_number: 20,
            hit_zone_key: "TREBLE",
            score: 60,
            location_x: "12.50",
            location_y: null,
          },
        ],
      }),
    } as any;

    const result = await findReplayTurnPage(db, baseQuery);

    expect(result).toEqual([
      {
        stageId: "stage-1",
        turnSequence: 1,
        participantId: "participant-1",
        participantName: "Alex",
        participantTypeKey: "PLAYER",
        turnTotalScore: 60,
        dartNumber: 1,
        intendedTargetNumber: 20,
        intendedZoneKey: "TREBLE",
        hitTargetNumber: 20,
        hitZoneKey: "TREBLE",
        score: 60,
        locationX: 12.5,
        locationY: null,
      },
    ]);
  });

  it("returns a turn-total-only row with every dart column null", async () => {
    const db = {
      execute: vi.fn().mockResolvedValue({
        rows: [
          {
            stage_id: "stage-1",
            turn_sequence: 1,
            participant_id: "participant-1",
            participant_name: "Alex",
            participant_type_key: "PLAYER",
            turn_total_score: 45,
            dart_number: null,
            intended_target_number: null,
            intended_zone_key: null,
            hit_target_number: null,
            hit_zone_key: null,
            score: null,
            location_x: null,
            location_y: null,
          },
        ],
      }),
    } as any;

    const result = await findReplayTurnPage(db, baseQuery);

    expect(result[0].dartNumber).toBeNull();
    expect(result[0].score).toBeNull();
  });

  it("nonNull throws on a null stage_id column", async () => {
    const db = {
      execute: vi.fn().mockResolvedValue({
        rows: [
          {
            stage_id: null,
            turn_sequence: 1,
            participant_id: "participant-1",
            participant_name: "Alex",
            participant_type_key: "PLAYER",
            turn_total_score: 45,
            dart_number: null,
            intended_target_number: null,
            intended_zone_key: null,
            hit_target_number: null,
            hit_zone_key: null,
            score: null,
            location_x: null,
            location_y: null,
          },
        ],
      }),
    } as any;

    await expect(findReplayTurnPage(db, baseQuery)).rejects.toThrow(/stage_id/);
  });
});

const routineStep = { routineKey: "routine-1", stepKey: "3-abc123" };

describe("dartScopeWhere / sessionScopeWhere routineStep predicate (decision 5)", () => {
  it("findIntentCells renders no session_id sub-select when routineStep is unset", async () => {
    const { db, statements } = renderingDb([]);
    await findIntentCells(db, { ...dartScope, bucket: "none", tz: undefined });
    const sql = onlyStatement(statements);
    expect(sql).not.toMatch(/"session_id" in \(select/i);
  });

  it("findIntentCells adds the routine step session_id sub-select when routineStep is set", async () => {
    const { db, statements } = renderingDb([]);
    await findIntentCells(db, {
      ...dartScope,
      bucket: "none",
      tz: undefined,
      routineStep,
    });
    const sql = onlyStatement(statements);
    expect(sql).toMatch(/"session_id" in \(select/i);
    expect(sql).toContain('"v_stats_routine_step_facts"');
    expect(sql).toMatch(/"routine_key" = \$/);
    expect(sql).toMatch(/"step_key" = \$/);
    expect(statements[0].params).toEqual(
      expect.arrayContaining([routineStep.routineKey, routineStep.stepKey]),
    );
  });

  it("findScopeDartCount renders no session_id sub-select when routineStep is unset", async () => {
    const { db, statements } = renderingDb([["0"]]);
    await findScopeDartCount(db, sessionScope);
    const sql = onlyStatement(statements);
    expect(sql).not.toMatch(/"session_id" in \(select/i);
  });

  it("findScopeDartCount adds the routine step session_id sub-select when routineStep is set", async () => {
    const { db, statements } = renderingDb([["0"]]);
    await findScopeDartCount(db, { ...sessionScope, routineStep });
    const sql = onlyStatement(statements);
    expect(sql).toMatch(/"session_id" in \(select/i);
    expect(sql).toContain('"v_stats_routine_step_facts"');
  });

  it("findBucketedSessionAggregates (R12: its own inline WHERE, not sessionScopeWhere) adds the sub-select when routineStep is set", async () => {
    const { db, statements } = renderingDb([]);
    await findBucketedSessionAggregates(db, {
      playerId: "p1",
      gameTypeKey: "501",
      from: "2026-01-01T00:00:00.000Z",
      to: "2026-02-01T00:00:00.000Z",
      bucket: "none",
      tz: undefined,
      statuses: ["COMPLETED"],
      context: "all",
      routineStep,
    });
    const sql = onlyStatement(statements);
    expect(sql).toMatch(/"session_id" in \(select/i);
    expect(sql).toContain('"v_stats_routine_step_facts"');
    expect(statements[0].params).toEqual(
      expect.arrayContaining([routineStep.routineKey, routineStep.stepKey]),
    );
  });

  it("findBucketedSessionAggregates renders no sub-select when routineStep is unset", async () => {
    const { db, statements } = renderingDb([]);
    await findBucketedSessionAggregates(db, {
      playerId: "p1",
      gameTypeKey: "501",
      from: "2026-01-01T00:00:00.000Z",
      to: "2026-02-01T00:00:00.000Z",
      bucket: "none",
      tz: undefined,
      statuses: ["COMPLETED"],
      context: "all",
    });
    const sql = onlyStatement(statements);
    expect(sql).not.toMatch(/"session_id" in \(select/i);
  });
});

describe("findTrainedRoutines", () => {
  it("selects from v_stats_routine_run_facts scoped to the player, grouped by routine_key", async () => {
    const { db, statements } = renderingDb([]);
    await findTrainedRoutines(db, "p1");
    const sql = onlyStatement(statements);
    expect(sql).toContain('"v_stats_routine_run_facts"');
    expect(sql).toMatch(/"player_id" = \$/);
    expect(sql).toMatch(/group by/i);
  });

  it("picks routineName from the latest run via array_agg(... order by completed_at desc)", async () => {
    const { db, statements } = renderingDb([]);
    await findTrainedRoutines(db, "p1");
    const sql = onlyStatement(statements);
    expect(sql).toMatch(
      /array_agg\("routine_name" order by "completed_at" desc\)/,
    );
  });

  it("orders the routine list by last_run_at desc", async () => {
    const { db, statements } = renderingDb([]);
    await findTrainedRoutines(db, "p1");
    const sql = onlyStatement(statements);
    const orderIndex = sql.toLowerCase().indexOf("order by");
    expect(orderIndex).toBeGreaterThan(-1);
    expect(sql.slice(orderIndex)).toMatch(/max\(.*"completed_at"\) desc/);
  });

  it("maps the group, parsing count strings to numbers", async () => {
    const chain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      groupBy: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockResolvedValue([
        {
          routineKey: "routine-1",
          routineTemplateId: "template-1",
          routineName: "Switching Ladder",
          runCount: "5",
          completedRunCount: "3",
          lastRunAt: "2026-09-20T10:00:00.000Z",
        },
      ]),
    };
    const db = { select: vi.fn(() => chain) } as any;

    const result = await findTrainedRoutines(db, "p1");

    expect(result).toEqual([
      {
        routineKey: "routine-1",
        routineTemplateId: "template-1",
        routineName: "Switching Ladder",
        runCount: 5,
        completedRunCount: 3,
        lastRunAt: "2026-09-20T10:00:00.000Z",
      },
    ]);
  });

  it("keeps a legacy routine's null routineTemplateId as null", async () => {
    const chain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      groupBy: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockResolvedValue([
        {
          routineKey: "name-abcdef0123456789abcdef0123456789",
          routineTemplateId: null,
          routineName: "Old Routine",
          runCount: "1",
          completedRunCount: "0",
          lastRunAt: "2026-09-20T10:00:00.000Z",
        },
      ]),
    };
    const db = { select: vi.fn(() => chain) } as any;

    const result = await findTrainedRoutines(db, "p1");

    expect(result[0].routineTemplateId).toBeNull();
  });

  it("nonNull throws on a null routine_key column", async () => {
    const chain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      groupBy: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockResolvedValue([
        {
          routineKey: null,
          routineTemplateId: null,
          routineName: "Old Routine",
          runCount: "1",
          completedRunCount: "0",
          lastRunAt: "2026-09-20T10:00:00.000Z",
        },
      ]),
    };
    const db = { select: vi.fn(() => chain) } as any;

    await expect(findTrainedRoutines(db, "p1")).rejects.toThrow(/routine_key/);
  });
});

describe("findRoutineHeader", () => {
  it("selects from v_stats_routine_run_facts filtered by player and routine_key", async () => {
    const { db, statements } = renderingDb([]);
    await findRoutineHeader(db, "p1", "routine-1");
    const sql = onlyStatement(statements);
    expect(sql).toContain('"v_stats_routine_run_facts"');
    expect(sql).toMatch(/"player_id" = \$/);
    expect(sql).toMatch(/"routine_key" = \$/);
  });

  it("returns null when the routine has no runs", async () => {
    const chain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      groupBy: vi.fn().mockResolvedValue([]),
    };
    const db = { select: vi.fn(() => chain) } as any;

    const result = await findRoutineHeader(db, "p1", "routine-1");

    expect(result).toBeNull();
  });

  it("maps counts and the latest run's step count, parsing the run count string", async () => {
    const chain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      groupBy: vi.fn().mockResolvedValue([
        {
          routineKey: "routine-1",
          routineName: "Switching Ladder",
          runCount: "4",
          firstRunAt: "2026-08-01T10:00:00.000Z",
          lastRunAt: "2026-09-20T10:00:00.000Z",
          latestStepCount: 3,
        },
      ]),
    };
    const db = { select: vi.fn(() => chain) } as any;

    const result = await findRoutineHeader(db, "p1", "routine-1");

    expect(result).toEqual({
      routineKey: "routine-1",
      routineName: "Switching Ladder",
      runCount: 4,
      firstRunAt: "2026-08-01T10:00:00.000Z",
      lastRunAt: "2026-09-20T10:00:00.000Z",
      latestStepCount: 3,
    });
  });

  it("keeps a null latestStepCount as null (an unreadable steps snapshot)", async () => {
    const chain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      groupBy: vi.fn().mockResolvedValue([
        {
          routineKey: "routine-1",
          routineName: "Switching Ladder",
          runCount: "4",
          firstRunAt: "2026-08-01T10:00:00.000Z",
          lastRunAt: "2026-09-20T10:00:00.000Z",
          latestStepCount: null,
        },
      ]),
    };
    const db = { select: vi.fn(() => chain) } as any;

    const result = await findRoutineHeader(db, "p1", "routine-1");

    expect(result?.latestStepCount).toBeNull();
  });

  it("nonNull throws on a null routine_name column", async () => {
    const chain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      groupBy: vi.fn().mockResolvedValue([
        {
          routineKey: "routine-1",
          routineName: null,
          runCount: "4",
          firstRunAt: "2026-08-01T10:00:00.000Z",
          lastRunAt: "2026-09-20T10:00:00.000Z",
          latestStepCount: 3,
        },
      ]),
    };
    const db = { select: vi.fn(() => chain) } as any;

    await expect(findRoutineHeader(db, "p1", "routine-1")).rejects.toThrow(
      /routine_name/,
    );
  });
});

describe("findRoutineStepDescriptors", () => {
  it("selects from v_stats_routine_step_facts filtered by player and routine_key, grouped by step_key", async () => {
    const { db, statements } = renderingDb([]);
    await findRoutineStepDescriptors(db, "p1", "routine-1", 3);
    const sql = onlyStatement(statements);
    expect(sql).toContain('"v_stats_routine_step_facts"');
    expect(sql).toMatch(/"player_id" = \$/);
    expect(sql).toMatch(/"routine_key" = \$/);
    expect(sql).toMatch(/group by/i);
  });

  it("reads durationSeconds from the snapshot element, not the session's own elapsed duration_seconds column (R11 item 1)", async () => {
    const { db, statements } = renderingDb([]);
    await findRoutineStepDescriptors(db, "p1", "routine-1", 3);
    const sql = onlyStatement(statements);
    expect(sql).toMatch(/"step" ->> 'durationSeconds'/);
    expect(sql).not.toMatch(
      /min\("duration_seconds"\)|max\("duration_seconds"\)/,
    );
  });

  it("orders by sequence_number, then last_seen_at desc", async () => {
    const { db, statements } = renderingDb([]);
    await findRoutineStepDescriptors(db, "p1", "routine-1", 3);
    const sql = onlyStatement(statements);
    const orderIndex = sql.toLowerCase().indexOf("order by");
    expect(orderIndex).toBeGreaterThan(-1);
    const orderClause = sql.slice(orderIndex);
    expect(orderClause).toMatch(
      /"sequence_number".*max\(.*"completed_at"\) desc/,
    );
  });

  it("maps a non-game step's null gameTypeKey/rulesetVersionKey through as null", async () => {
    const chain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      groupBy: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockResolvedValue([
        {
          stepKey: "1-abc",
          sequenceNumber: 1,
          exerciseTypeKey: "SWITCHING",
          exerciseRulesetVersionKey: "SWITCHING_V1",
          gameTypeKey: null,
          rulesetVersionKey: null,
          durationSeconds: "60",
          sessionCount: "3",
          firstSeenAt: "2026-08-01T10:00:00.000Z",
          lastSeenAt: "2026-09-20T10:00:00.000Z",
          isCurrentAtSequence: true,
        },
      ]),
    };
    const db = { select: vi.fn(() => chain) } as any;

    const result = await findRoutineStepDescriptors(db, "p1", "routine-1", 3);

    expect(result).toEqual([
      {
        stepKey: "1-abc",
        sequenceNumber: 1,
        exerciseTypeKey: "SWITCHING",
        exerciseRulesetVersionKey: "SWITCHING_V1",
        gameTypeKey: null,
        rulesetVersionKey: null,
        durationSeconds: 60,
        sessionCount: 3,
        firstSeenAt: "2026-08-01T10:00:00.000Z",
        lastSeenAt: "2026-09-20T10:00:00.000Z",
        current: true,
      },
    ]);
  });

  it("keeps a null durationSeconds as null (an unreadable snapshot element)", async () => {
    const chain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      groupBy: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockResolvedValue([
        {
          stepKey: "1-abc",
          sequenceNumber: 1,
          exerciseTypeKey: "SWITCHING",
          exerciseRulesetVersionKey: "SWITCHING_V1",
          gameTypeKey: null,
          rulesetVersionKey: null,
          durationSeconds: null,
          sessionCount: "3",
          firstSeenAt: "2026-08-01T10:00:00.000Z",
          lastSeenAt: "2026-09-20T10:00:00.000Z",
          isCurrentAtSequence: true,
        },
      ]),
    };
    const db = { select: vi.fn(() => chain) } as any;

    const result = await findRoutineStepDescriptors(db, "p1", "routine-1", 3);

    expect(result[0].durationSeconds).toBeNull();
  });

  it("maps a GAME step's resolved gameTypeKey/rulesetVersionKey through", async () => {
    const chain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      groupBy: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockResolvedValue([
        {
          stepKey: "2-def",
          sequenceNumber: 2,
          exerciseTypeKey: "GAME",
          exerciseRulesetVersionKey: null,
          gameTypeKey: "501",
          rulesetVersionKey: "501_V1",
          durationSeconds: "0",
          sessionCount: "2",
          firstSeenAt: "2026-08-01T10:00:00.000Z",
          lastSeenAt: "2026-09-20T10:00:00.000Z",
          isCurrentAtSequence: false,
        },
      ]),
    };
    const db = { select: vi.fn(() => chain) } as any;

    const result = await findRoutineStepDescriptors(db, "p1", "routine-1", 3);

    expect(result[0].gameTypeKey).toBe("501");
    expect(result[0].rulesetVersionKey).toBe("501_V1");
    expect(result[0].current).toBe(false);
  });

  it("R11: a superseded key at an index (not the most recent there) reads current=false even when the index is in range", async () => {
    const chain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      groupBy: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockResolvedValue([
        {
          stepKey: "1-old",
          sequenceNumber: 1,
          exerciseTypeKey: "SWITCHING",
          exerciseRulesetVersionKey: "SWITCHING_V1",
          gameTypeKey: null,
          rulesetVersionKey: null,
          durationSeconds: "60",
          sessionCount: "2",
          firstSeenAt: "2026-01-01T10:00:00.000Z",
          lastSeenAt: "2026-02-01T10:00:00.000Z",
          isCurrentAtSequence: false,
        },
        {
          stepKey: "1-new",
          sequenceNumber: 1,
          exerciseTypeKey: "SWITCHING",
          exerciseRulesetVersionKey: "SWITCHING_V2",
          gameTypeKey: null,
          rulesetVersionKey: null,
          durationSeconds: "90",
          sessionCount: "1",
          firstSeenAt: "2026-09-01T10:00:00.000Z",
          lastSeenAt: "2026-09-20T10:00:00.000Z",
          isCurrentAtSequence: true,
        },
      ]),
    };
    const db = { select: vi.fn(() => chain) } as any;

    const result = await findRoutineStepDescriptors(db, "p1", "routine-1", 3);

    expect(result.find((row) => row.stepKey === "1-old")?.current).toBe(false);
    expect(result.find((row) => row.stepKey === "1-new")?.current).toBe(true);
  });

  it("R11: an index beyond the latest run's step count reads current=false even when it is the most recent key there", async () => {
    const chain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      groupBy: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockResolvedValue([
        {
          stepKey: "5-abc",
          sequenceNumber: 5,
          exerciseTypeKey: "SWITCHING",
          exerciseRulesetVersionKey: "SWITCHING_V1",
          gameTypeKey: null,
          rulesetVersionKey: null,
          durationSeconds: "60",
          sessionCount: "1",
          firstSeenAt: "2026-08-01T10:00:00.000Z",
          lastSeenAt: "2026-09-20T10:00:00.000Z",
          isCurrentAtSequence: true,
        },
      ]),
    };
    const db = { select: vi.fn(() => chain) } as any;

    const result = await findRoutineStepDescriptors(db, "p1", "routine-1", 3);

    expect(result[0].current).toBe(false);
  });

  it("R11: current is always false when latestStepCount is null", async () => {
    const chain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      groupBy: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockResolvedValue([
        {
          stepKey: "1-abc",
          sequenceNumber: 1,
          exerciseTypeKey: "SWITCHING",
          exerciseRulesetVersionKey: "SWITCHING_V1",
          gameTypeKey: null,
          rulesetVersionKey: null,
          durationSeconds: "60",
          sessionCount: "1",
          firstSeenAt: "2026-08-01T10:00:00.000Z",
          lastSeenAt: "2026-09-20T10:00:00.000Z",
          isCurrentAtSequence: true,
        },
      ]),
    };
    const db = { select: vi.fn(() => chain) } as any;

    const result = await findRoutineStepDescriptors(
      db,
      "p1",
      "routine-1",
      null,
    );

    expect(result[0].current).toBe(false);
  });

  it("nonNull throws on a null step_key column", async () => {
    const chain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      groupBy: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockResolvedValue([
        {
          stepKey: null,
          sequenceNumber: 1,
          exerciseTypeKey: "SWITCHING",
          exerciseRulesetVersionKey: "SWITCHING_V1",
          gameTypeKey: null,
          rulesetVersionKey: null,
          durationSeconds: "60",
          sessionCount: "3",
          firstSeenAt: "2026-08-01T10:00:00.000Z",
          lastSeenAt: "2026-09-20T10:00:00.000Z",
          isCurrentAtSequence: true,
        },
      ]),
    };
    const db = { select: vi.fn(() => chain) } as any;

    await expect(
      findRoutineStepDescriptors(db, "p1", "routine-1", 3),
    ).rejects.toThrow(/step_key/);
  });
});

describe("findRoutineDataVersion", () => {
  it("returns the raw { runCount, maxCompletedAt } shape, like findGameDataVersion, for the service to encode (R13)", async () => {
    const chain = {
      from: vi.fn().mockReturnThis(),
      where: vi
        .fn()
        .mockResolvedValue([
          { count: "6", maxCompletedAt: "2026-09-20T10:00:00.000Z" },
        ]),
    };
    const db = { select: vi.fn(() => chain) } as any;

    const result = await findRoutineDataVersion(db, "p1", "routine-1");

    expect(result).toEqual({
      runCount: 6,
      maxCompletedAt: "2026-09-20T10:00:00.000Z",
    });
  });

  it("selects from v_stats_routine_run_facts filtered by player and routine_key", async () => {
    const { db, statements } = renderingDb([["0", null]]);
    await findRoutineDataVersion(db, "p1", "routine-1");
    const sql = onlyStatement(statements);
    expect(sql).toContain('"v_stats_routine_run_facts"');
    expect(sql).toMatch(/"player_id" = \$/);
    expect(sql).toMatch(/"routine_key" = \$/);
  });
});

describe("findRoutineRunBuckets", () => {
  const baseQuery = {
    playerId: "p1",
    routineKey: "routine-1",
    from: "2026-01-01T00:00:00.000Z",
    to: "2026-02-01T00:00:00.000Z",
    statuses: ["COMPLETED", "ABANDONED"],
  };

  it("reads v_stats_routine_run_facts filtered by player_id and routine_key on bucket=none", async () => {
    const { db, statements } = renderingDb([]);
    await findRoutineRunBuckets(db, {
      ...baseQuery,
      bucket: "none",
      tz: undefined,
    });
    const sql = onlyStatement(statements);
    expect(sql).toContain('"v_stats_routine_run_facts"');
    expect(sql).toMatch(/player_id/);
    expect(sql).toMatch(/routine_key/);
  });

  it("renders the exact bucketExprs form for bucket_end (item 2: interval added inside the single AT TIME ZONE wrap, not outside it)", async () => {
    const { db, statements } = renderingDb([]);
    await findRoutineRunBuckets(db, {
      ...baseQuery,
      bucket: "month",
      tz: "Europe/Amsterdam",
    });
    const sql = onlyStatement(statements);
    expect(sql).toMatch(/date_trunc\('month', .*AT TIME ZONE \$/);
    expect(sql).toMatch(
      /date_trunc\('month', .*\) \+ interval '1 month'\) AT TIME ZONE \$/,
    );
    expect(sql).not.toMatch(
      /AT TIME ZONE \$\d+\) AT TIME ZONE \$\d+\) \+ interval '1 month'/,
    );
  });

  it("filters the abandoned/never-started counts by steps_started (item 3: partition, mirroring completionBuckets)", async () => {
    const { db, statements } = renderingDb([]);
    await findRoutineRunBuckets(db, {
      ...baseQuery,
      bucket: "none",
      tz: undefined,
    });
    const sql = onlyStatement(statements);
    expect(sql).toMatch(
      /status_key = 'ABANDONED' AND steps_started > 0.*AS abandoned/,
    );
    expect(sql).toMatch(
      /status_key = 'ABANDONED' AND steps_started = 0.*AS never_started/,
    );
  });

  it("filters the abandoned/never-started counts by steps_started on bucket=month too", async () => {
    const { db, statements } = renderingDb([]);
    await findRoutineRunBuckets(db, {
      ...baseQuery,
      bucket: "month",
      tz: "Europe/Amsterdam",
    });
    const sql = onlyStatement(statements);
    expect(sql).toMatch(
      /status_key = 'ABANDONED' AND steps_started > 0.*AS abandoned/,
    );
    expect(sql).toMatch(
      /status_key = 'ABANDONED' AND steps_started = 0.*AS never_started/,
    );
  });

  it("excludes never-started runs from the abandon histogram (item 3)", async () => {
    const { db, statements } = renderingDb([]);
    await findRoutineRunBuckets(db, {
      ...baseQuery,
      bucket: "none",
      tz: undefined,
    });
    const sql = onlyStatement(statements);
    const histogramIndex = sql.indexOf("steps_completed_at_abandon");
    expect(histogramIndex).toBeGreaterThan(-1);
    const histogramClause = sql.slice(0, histogramIndex);
    expect(histogramClause).toMatch(
      /status_key = 'ABANDONED' AND steps_started > 0/,
    );
  });

  it("groups the histogram on bucket=month via a joined CTE, not a per-row correlated subquery", async () => {
    const { db, statements } = renderingDb([]);
    await findRoutineRunBuckets(db, {
      ...baseQuery,
      bucket: "month",
      tz: "Europe/Amsterdam",
    });
    const sql = onlyStatement(statements);
    expect(sql.toLowerCase()).not.toMatch(/lateral/);
    expect(sql.toLowerCase()).toMatch(/left join "?hist"?/);
  });

  it("maps a bucket row, parsing every count/sum to a number and passing the histogram through", async () => {
    const db = {
      execute: vi.fn().mockResolvedValue({
        rows: [
          {
            bucket_start: "2026-01-01T00:00:00.000Z",
            bucket_end: "2026-02-01T00:00:00.000Z",
            runs: 5,
            duration_sum: 3000,
            duration_min: 100,
            duration_max: 900,
            darts: 450,
            completed: 3,
            abandoned: 2,
            never_started: 1,
            steps_completed_at_abandon: { "1": 1, "2": 1 },
          },
        ],
      }),
    } as any;

    const result = await findRoutineRunBuckets(db, {
      ...baseQuery,
      bucket: "none",
      tz: undefined,
    });

    expect(result).toEqual([
      {
        bucketStart: "2026-01-01T00:00:00.000Z",
        bucketEnd: "2026-02-01T00:00:00.000Z",
        runs: 5,
        durationSum: 3000,
        durationMin: 100,
        durationMax: 900,
        darts: 450,
        completed: 3,
        abandoned: 2,
        neverStarted: 1,
        stepsCompletedAtAbandon: { "1": 1, "2": 1 },
      },
    ]);
  });

  it("nonNull throws on a null bucket_start column", async () => {
    const db = {
      execute: vi.fn().mockResolvedValue({
        rows: [
          {
            bucket_start: null,
            bucket_end: "2026-02-01T00:00:00.000Z",
            runs: 0,
            duration_sum: 0,
            duration_min: 0,
            duration_max: 0,
            darts: 0,
            completed: 0,
            abandoned: 0,
            never_started: 0,
            steps_completed_at_abandon: {},
          },
        ],
      }),
    } as any;

    await expect(
      findRoutineRunBuckets(db, {
        ...baseQuery,
        bucket: "none",
        tz: undefined,
      }),
    ).rejects.toThrow(/bucket_start/);
  });
});

describe("findStepBuckets", () => {
  const baseQuery = {
    playerId: "p1",
    routineKey: "routine-1",
    stepKey: "3-abc123",
    from: "2026-01-01T00:00:00.000Z",
    to: "2026-02-01T00:00:00.000Z",
    statuses: ["COMPLETED"],
  };

  it("reads v_stats_routine_step_facts filtered by player_id, routine_key and step_key", async () => {
    const { db, statements } = renderingDb([]);
    await findStepBuckets(db, { ...baseQuery, bucket: "none", tz: undefined });
    const sql = onlyStatement(statements);
    expect(sql).toContain('"v_stats_routine_step_facts"');
    expect(sql).toMatch(/"player_id" = \$/);
    expect(sql).toMatch(/"routine_key" = \$/);
    expect(sql).toMatch(/"step_key" = \$/);
  });

  it("renders the whitelisted bucket expression on bucket=week (via the shared bucketExprs, item 2's check)", async () => {
    const { db, statements } = renderingDb([]);
    await findStepBuckets(db, {
      ...baseQuery,
      bucket: "week",
      tz: "Europe/Amsterdam",
    });
    const sql = onlyStatement(statements);
    expect(sql).toMatch(/date_trunc\('week', .*AT TIME ZONE \$/);
    expect(sql).toMatch(
      /date_trunc\('week', .*\) \+ interval '1 week'\) AT TIME ZONE \$/,
    );
  });

  it("parses the sum strings to numbers", async () => {
    const chain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue([
        {
          bucketStart: "2026-01-01T00:00:00.000Z",
          bucketEnd: "2026-02-01T00:00:00.000Z",
          sessions: "4",
          durationSum: "240",
          darts: "120",
        },
      ]),
    };
    const db = { select: vi.fn(() => chain) } as any;

    const result = await findStepBuckets(db, {
      ...baseQuery,
      bucket: "none",
      tz: undefined,
    });

    expect(result).toEqual([
      {
        bucketStart: "2026-01-01T00:00:00.000Z",
        bucketEnd: "2026-02-01T00:00:00.000Z",
        sessions: 4,
        durationSum: 240,
        darts: 120,
      },
    ]);
  });
});

describe("findStepSessionPage", () => {
  const baseQuery = {
    playerId: "p1",
    routineKey: "routine-1",
    stepKey: "3-abc123",
    from: "2026-01-01T00:00:00.000Z",
    to: "2026-02-01T00:00:00.000Z",
    statuses: ["COMPLETED", "ABANDONED"],
    limit: 25,
  };

  it("selects from v_stats_routine_step_facts scoped to player, routine_key and step_key", async () => {
    const { db, statements } = renderingDb([]);
    await findStepSessionPage(db, baseQuery);
    const sql = onlyStatement(statements);
    expect(sql).toContain('"v_stats_routine_step_facts"');
    expect(sql).toMatch(/"player_id" = \$/);
    expect(sql).toMatch(/"routine_key" = \$/);
    expect(sql).toMatch(/"step_key" = \$/);
  });

  it("orders by completed_at desc, session_id desc and fetches limit + 1", async () => {
    const { db, statements } = renderingDb([]);
    await findStepSessionPage(db, baseQuery);
    const sql = onlyStatement(statements);
    expect(sql).toMatch(/order by .*"completed_at" desc.*"session_id" desc/);
    expect(statements[0].params).toContain(26);
  });

  it("adds the keyset predicate when a cursor is given", async () => {
    const { db, statements } = renderingDb([]);
    await findStepSessionPage(db, {
      ...baseQuery,
      after: { completedAt: "2026-01-15T00:00:00.000Z", sessionId: "s1" },
    });
    const sql = onlyStatement(statements);
    expect(sql).toContain("<");
    expect(statements[0].params).toEqual(
      expect.arrayContaining(["2026-01-15T00:00:00.000Z", "s1"]),
    );
  });

  it("marks a turn-free abandoned row as neverStarted", async () => {
    const chain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([
        {
          sessionId: "s1",
          rulesetVersionKey: null,
          exerciseRulesetVersionKey: "SWITCHING_V1",
          statusKey: "ABANDONED",
          startedAt: "2026-01-01T00:00:00.000Z",
          completedAt: "2026-01-01T00:01:00.000Z",
          durationSeconds: 60,
          turnCount: 0,
          dartCount: 0,
          countedScore: 0,
        },
      ]),
    };
    const db = { select: vi.fn(() => chain) } as any;

    const result = await findStepSessionPage(db, baseQuery);

    expect(result[0].neverStarted).toBe(true);
  });
});

describe("findStepFoldRows", () => {
  const stepScope = {
    playerId: "p1",
    routineKey: "routine-1",
    stepKey: "3-abc123",
    from: "2026-01-01T00:00:00.000Z",
    to: "2026-02-01T00:00:00.000Z",
    statuses: ["COMPLETED", "ABANDONED"],
  };

  it("reads v_game_replay joined to v_stats_routine_step_facts, scoped to player, routine_key and step_key", async () => {
    const { db, statements } = renderingDb([]);
    await findStepFoldRows(db, { ...stepScope, bucket: "none", tz: undefined });
    const sql = onlyStatement(statements);
    expect(sql).toContain('"v_game_replay"');
    expect(sql).toContain('"v_stats_routine_step_facts"');
    expect(sql).toMatch(/"player_id" = \$/);
    expect(sql).toMatch(/"routine_key" = \$/);
    expect(sql).toMatch(/"step_key" = \$/);
  });

  it("orders by session_id, stage_sequence, turn_sequence, dart_number", async () => {
    const { db, statements } = renderingDb([]);
    await findStepFoldRows(db, { ...stepScope, bucket: "none", tz: undefined });
    const sql = onlyStatement(statements);
    const orderIndex = sql.toLowerCase().indexOf("order by");
    expect(orderIndex).toBeGreaterThan(-1);
    const orderClause = sql.slice(orderIndex);
    expect(orderClause).toMatch(
      /"session_id".*"stage_sequence".*"turn_sequence".*"dart_number"/,
    );
  });

  it("renders the bucket expression on bucket=month", async () => {
    const { db, statements } = renderingDb([]);
    await findStepFoldRows(db, {
      ...stepScope,
      bucket: "month",
      tz: "Europe/Amsterdam",
    });
    const sql = onlyStatement(statements);
    expect(sql).toMatch(/date_trunc\('month', .*AT TIME ZONE \$/);
  });

  it("carries sessionId, completedAt, exerciseRulesetVersionKey, configuration, the stage columns and the bucket bounds alongside the replay row", async () => {
    const configuration = { targetSequence: [20, 19, 18] };
    const chain = {
      from: vi.fn().mockReturnThis(),
      innerJoin: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockResolvedValue([
        {
          sessionId: "s1",
          completedAt: "2026-01-05T10:00:00.000Z",
          exerciseRulesetVersionKey: "SWITCHING_V1",
          configuration,
          stageId: "stage-1",
          stageSequence: 1,
          stageTypeKey: "EXERCISE_BLOCK",
          parentStageId: null,
          turnSequence: 1,
          participantId: "participant-1",
          participantName: "Alex",
          participantTypeKey: "PLAYER",
          turnTotalScore: 60,
          dartNumber: 1,
          intendedTargetNumber: 20,
          intendedZoneKey: "TREBLE",
          hitTargetNumber: 20,
          hitZoneKey: "TREBLE",
          score: 60,
          locationX: "1.50",
          locationY: "-2.25",
          bucketStart: "2026-01-01T00:00:00.000Z",
          bucketEnd: "2026-02-01T00:00:00.000Z",
        },
      ]),
    };
    const db = { select: vi.fn(() => chain) } as any;

    const result = await findStepFoldRows(db, {
      ...stepScope,
      bucket: "none",
      tz: undefined,
    });

    expect(result).toEqual([
      {
        sessionId: "s1",
        completedAt: "2026-01-05T10:00:00.000Z",
        exerciseRulesetVersionKey: "SWITCHING_V1",
        configuration,
        stageId: "stage-1",
        stageSequence: 1,
        stageTypeKey: "EXERCISE_BLOCK",
        parentStageId: null,
        turnSequence: 1,
        participantId: "participant-1",
        participantName: "Alex",
        participantTypeKey: "PLAYER",
        turnTotalScore: 60,
        dartNumber: 1,
        intendedTargetNumber: 20,
        intendedZoneKey: "TREBLE",
        hitTargetNumber: 20,
        hitZoneKey: "TREBLE",
        score: 60,
        locationX: 1.5,
        locationY: -2.25,
        bucketStart: "2026-01-01T00:00:00.000Z",
        bucketEnd: "2026-02-01T00:00:00.000Z",
      },
    ]);
  });

  it("nonNull throws on a null session_id column", async () => {
    const chain = {
      from: vi.fn().mockReturnThis(),
      innerJoin: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockResolvedValue([
        {
          sessionId: null,
          completedAt: "2026-01-05T10:00:00.000Z",
          exerciseRulesetVersionKey: "SWITCHING_V1",
          configuration: null,
          stageId: "stage-1",
          stageSequence: 1,
          stageTypeKey: "EXERCISE_BLOCK",
          parentStageId: null,
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
          bucketStart: "2026-01-01T00:00:00.000Z",
          bucketEnd: "2026-02-01T00:00:00.000Z",
        },
      ]),
    };
    const db = { select: vi.fn(() => chain) } as any;

    await expect(
      findStepFoldRows(db, { ...stepScope, bucket: "none", tz: undefined }),
    ).rejects.toThrow(/session_id/);
  });
});

describe("findStepScopeDartCount", () => {
  const stepScope = {
    playerId: "p1",
    routineKey: "routine-1",
    stepKey: "3-abc123",
    from: "2026-01-01T00:00:00.000Z",
    to: "2026-02-01T00:00:00.000Z",
    statuses: ["COMPLETED"],
  };

  it("selects the dart-count sum from v_stats_routine_step_facts scoped by routine_key and step_key", async () => {
    const { db, statements } = renderingDb([["0"]]);
    await findStepScopeDartCount(db, stepScope);
    const sql = onlyStatement(statements);
    expect(sql).toContain('"v_stats_routine_step_facts"');
    expect(sql).toMatch(/"routine_key" = \$/);
    expect(sql).toMatch(/"step_key" = \$/);
  });

  it("parses the sum from a string", async () => {
    const chain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue([{ dartCount: "789" }]),
    };
    const db = { select: vi.fn(() => chain) } as any;

    const result = await findStepScopeDartCount(db, stepScope);

    expect(result).toBe(789);
  });
});
