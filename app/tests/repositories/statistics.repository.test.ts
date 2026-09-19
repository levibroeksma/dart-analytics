import { describe, it, expect, vi } from "vitest";

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
 * is gone — migration `0038` replaced it with `v_x01_checkout_darts`, a
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
