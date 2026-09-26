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
  findVisitScoring,
  findHitNumberCells,
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
