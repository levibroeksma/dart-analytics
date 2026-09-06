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

function fakeDoubleOutQuery(rows: unknown[]) {
  return {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockResolvedValue(rows),
  };
}

function fakeConfigQuery(rows: unknown[]) {
  return {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockResolvedValue(rows),
  };
}

describe("findDoubleOutVisits", () => {
  it("returns an empty array when the player has no double-out darts", async () => {
    const db = { select: vi.fn(() => fakeDoubleOutQuery([])) } as any;
    const { findDoubleOutVisits } =
      await import("@repositories/statistics.repository");

    const result = await findDoubleOutVisits(db, "p1");

    expect(result).toEqual([]);
    expect(db.select).toHaveBeenCalledTimes(1);
  });

  it("groups darts by turn and computes startingRemaining from the session's starting_score", async () => {
    const dartRows = [
      {
        sessionId: "s1",
        stageId: "stage-1",
        turnSequence: 1,
        dartNumber: 1,
        hitTargetNumber: 20,
        hitZoneKey: "TREBLE",
        score: 60,
        priorScoredInStage: null,
      },
      {
        sessionId: "s1",
        stageId: "stage-1",
        turnSequence: 1,
        dartNumber: 2,
        hitTargetNumber: 20,
        hitZoneKey: "TREBLE",
        score: 60,
        priorScoredInStage: 60,
      },
      {
        sessionId: "s1",
        stageId: "stage-1",
        turnSequence: 2,
        dartNumber: 1,
        hitTargetNumber: 20,
        hitZoneKey: "DOUBLE",
        score: 40,
        priorScoredInStage: 120,
      },
    ];
    const configRows = [
      { sessionId: "s1", configuration: { starting_score: 501 } },
    ];
    const db = {
      select: vi
        .fn()
        .mockReturnValueOnce(fakeDoubleOutQuery(dartRows))
        .mockReturnValueOnce(fakeConfigQuery(configRows)),
    } as any;
    const { findDoubleOutVisits } =
      await import("@repositories/statistics.repository");

    const result = await findDoubleOutVisits(db, "p1");

    expect(result).toEqual([
      {
        startingRemaining: 501,
        darts: [
          {
            sequence: 1,
            intendedTargetNumber: null,
            intendedZoneKey: null,
            hitTargetNumber: 20,
            hitZoneKey: "TREBLE",
            score: 60,
            locationX: null,
            locationY: null,
          },
          {
            sequence: 2,
            intendedTargetNumber: null,
            intendedZoneKey: null,
            hitTargetNumber: 20,
            hitZoneKey: "TREBLE",
            score: 60,
            locationX: null,
            locationY: null,
          },
        ],
      },
      {
        startingRemaining: 381,
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
  });
});
