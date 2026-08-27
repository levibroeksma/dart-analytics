import { describe, it, expect, vi } from "vitest";

function fakeSelect(rows: unknown[]) {
  const chain = {
    from: vi.fn().mockReturnThis(),
    innerJoin: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    groupBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue(rows),
    then: (resolve: (v: unknown[]) => void) => resolve(rows), // supports `await db.select(...).from(...)` without .limit()
  };
  return chain;
}

describe("findGameTypeAndRuleset", () => {
  it("returns the joined row when found", async () => {
    const row = { gameTypeId: "gt-1", rulesetVersionId: "rv-1" };
    const db = { select: vi.fn(() => fakeSelect([row])) } as any;
    const { findGameTypeAndRuleset } =
      await import("@repositories/session.repository");
    const result = await findGameTypeAndRuleset(
      db,
      "SCORE_TRAINING",
      "SCORE_TRAINING_V1",
    );
    expect(result).toEqual(row);
  });

  it("returns undefined when no row matches", async () => {
    const db = { select: vi.fn(() => fakeSelect([])) } as any;
    const { findGameTypeAndRuleset } =
      await import("@repositories/session.repository");
    const result = await findGameTypeAndRuleset(db, "UNKNOWN", "UNKNOWN_V1");
    expect(result).toBeUndefined();
  });
});

describe("findStageTypeIdMap", () => {
  it("builds a key-to-id map", async () => {
    const db = {
      select: vi.fn(() => fakeSelect([{ id: 5, key: "EXERCISE_BLOCK" }])),
    } as any;
    const { findStageTypeIdMap } =
      await import("@repositories/session.repository");
    const map = await findStageTypeIdMap(db);
    expect(map.get("EXERCISE_BLOCK")).toBe(5);
  });
});

describe("findSessionRow", () => {
  it("joins ruleset_versions, capture_modes and input_modes to expose their keys", async () => {
    const row = {
      id: "s1",
      playerId: "p1",
      statusId: 1,
      rulesetVersionKey: "SCORE_TRAINING_V1",
      captureModeKey: "RECREATIONAL",
      inputModeKey: "QUICK_SCORE",
    };
    const db = { select: vi.fn(() => fakeSelect([row])) } as any;
    const { findSessionRow } = await import("@repositories/session.repository");
    const result = await findSessionRow(db, "s1");
    expect(result).toEqual(row);
  });
});

describe("countTurnsForSession", () => {
  it("groups turn counts by participant id", async () => {
    const db = {
      select: vi.fn(() =>
        fakeSelect([
          { participantId: "p1", count: 2 },
          { participantId: "p2", count: 1 },
        ]),
      ),
    } as any;
    const { countTurnsForSession } =
      await import("@repositories/session.repository");
    const result = await countTurnsForSession(db, "s1");
    expect(result).toEqual({ p1: 2, p2: 1 });
  });

  it("returns an empty map when no rows exist", async () => {
    const db = { select: vi.fn(() => fakeSelect([])) } as any;
    const { countTurnsForSession } =
      await import("@repositories/session.repository");
    const result = await countTurnsForSession(db, "s1");
    expect(result).toEqual({});
  });
});

describe("findIdempotencyRecord", () => {
  it("returns the stored record when present", async () => {
    const record = {
      normalizedPayloadHash: "abc",
      result: { created: { stages: 1, turns: 1, darts: 0 } },
    };
    const db = { select: vi.fn(() => fakeSelect([record])) } as any;
    const { findIdempotencyRecord } =
      await import("@repositories/session.repository");
    const result = await findIdempotencyRecord(db, "s1", "key-1");
    expect(result).toEqual(record);
  });
});

vi.mock("@db/client", () => ({
  withTransaction: vi.fn(async (fn: (tx: unknown) => unknown) => {
    // Every table's `.insert(...).values(...)` just needs to resolve — this
    // proves insertSessionRecords runs inside withTransaction and returns the
    // right shape, without asserting per-table row content (see note below).
    const tx = { insert: () => ({ values: () => Promise.resolve() }) };
    return fn(tx);
  }),
}));

describe("insertSessionRecords", () => {
  it("resolves with the generated sessionId", async () => {
    const { insertSessionRecords } =
      await import("@repositories/session.repository");
    const result = await insertSessionRecords({
      activityId: "a1",
      sessionId: "s1",
      configurationId: "c1",
      participants: [
        {
          id: "pt1",
          participantTypeId: 1,
          playerId: "p1",
          displayName: "Levi",
        },
      ],
      playerId: "p1",
      gameTypeId: "gt1",
      rulesetVersionId: "rv1",
      captureModeId: 1,
      inputModeId: 1,
      activeStatusId: 1,
      configuration: {
        duration_type: "ROUNDS",
        duration_value: 10,
        max_darts_per_turn: 3,
      },
    });
    expect(result).toEqual({ sessionId: "s1" });
  });
});

describe("insertBatchRecords", () => {
  it("resolves with the created counts", async () => {
    const { insertBatchRecords } =
      await import("@repositories/session.repository");
    const result = await insertBatchRecords({
      sessionId: "s1",
      idempotencyRecordId: "idem-row-1",
      idempotencyKey: "idem-1",
      normalizedPayloadHash: "hash-1",
      stages: [
        {
          id: "stage-1",
          parentStageId: null,
          stageTypeId: 5,
          sequenceNumber: 1,
        },
      ],
      turns: [
        {
          id: "turn-1",
          stageId: "stage-1",
          participantId: "p1",
          sequenceNumber: 1,
          totalScore: 45,
          completedAt: null,
          darts: [],
        },
      ],
    });
    expect(result).toEqual({ stages: 1, turns: 1, darts: 0 });
  });

  it("resolves with zero counts for an empty batch", async () => {
    const { insertBatchRecords } =
      await import("@repositories/session.repository");
    const result = await insertBatchRecords({
      sessionId: "s1",
      idempotencyRecordId: "idem-row-2",
      idempotencyKey: "idem-2",
      normalizedPayloadHash: "hash-2",
      stages: [],
      turns: [],
    });
    expect(result).toEqual({ stages: 0, turns: 0, darts: 0 });
  });

  it("carries the dart location pair into the darts insert as numeric strings", async () => {
    const { darts: dartsTable } = await import("@db/schema");
    const { withTransaction } = await import("@db/client");
    const insertCalls: { table: unknown; rows: unknown[] }[] = [];
    vi.mocked(withTransaction).mockImplementationOnce((async (
      fn: (tx: unknown) => unknown,
    ) => {
      const tx = {
        insert: (table: unknown) => ({
          values: (rows: unknown[]) => {
            insertCalls.push({ table, rows });
            return Promise.resolve();
          },
        }),
      };
      return fn(tx);
    }) as any);

    const { insertBatchRecords } =
      await import("@repositories/session.repository");
    await insertBatchRecords({
      sessionId: "s1",
      idempotencyRecordId: "idem-row-3",
      idempotencyKey: "idem-3",
      normalizedPayloadHash: "hash-3",
      stages: [],
      turns: [
        {
          id: "turn-1",
          stageId: "stage-1",
          participantId: "p1",
          sequenceNumber: 1,
          totalScore: 60,
          completedAt: null,
          darts: [
            {
              id: "dart-1",
              dartNumber: 1,
              intendedTargetNumber: null,
              intendedZoneId: null,
              hitTargetNumber: 20,
              hitZoneId: 9,
              score: 60,
              locationX: 0,
              locationY: -102,
            },
          ],
        },
      ],
    });

    const dartsCall = insertCalls.find((call) => call.table === dartsTable);
    expect(dartsCall?.rows[0]).toMatchObject({
      locationX: "0",
      locationY: "-102",
    });
  });

  it("preserves fractional coordinates as precise strings", async () => {
    const { darts: dartsTable } = await import("@db/schema");
    const { withTransaction } = await import("@db/client");
    const insertCalls: { table: unknown; rows: unknown[] }[] = [];
    vi.mocked(withTransaction).mockImplementationOnce((async (
      fn: (tx: unknown) => unknown,
    ) => {
      const tx = {
        insert: (table: unknown) => ({
          values: (rows: unknown[]) => {
            insertCalls.push({ table, rows });
            return Promise.resolve();
          },
        }),
      };
      return fn(tx);
    }) as any);

    const { insertBatchRecords } =
      await import("@repositories/session.repository");
    await insertBatchRecords({
      sessionId: "s2",
      idempotencyRecordId: "idem-row-4",
      idempotencyKey: "idem-4",
      normalizedPayloadHash: "hash-4",
      stages: [],
      turns: [
        {
          id: "turn-2",
          stageId: "stage-2",
          participantId: "p2",
          sequenceNumber: 1,
          totalScore: 50,
          completedAt: null,
          darts: [
            {
              id: "dart-2",
              dartNumber: 1,
              intendedTargetNumber: null,
              intendedZoneId: null,
              hitTargetNumber: 18,
              hitZoneId: 5,
              score: 50,
              locationX: -166.5,
              locationY: 45.25,
            },
          ],
        },
      ],
    });

    const dartsCall = insertCalls.find((call) => call.table === dartsTable);
    expect(dartsCall?.rows[0]).toMatchObject({
      locationX: "-166.5",
      locationY: "45.25",
    });
  });

  it("converts null coordinates to database null, not the string 'null'", async () => {
    const { darts: dartsTable } = await import("@db/schema");
    const { withTransaction } = await import("@db/client");
    const insertCalls: { table: unknown; rows: unknown[] }[] = [];
    vi.mocked(withTransaction).mockImplementationOnce((async (
      fn: (tx: unknown) => unknown,
    ) => {
      const tx = {
        insert: (table: unknown) => ({
          values: (rows: unknown[]) => {
            insertCalls.push({ table, rows });
            return Promise.resolve();
          },
        }),
      };
      return fn(tx);
    }) as any);

    const { insertBatchRecords } =
      await import("@repositories/session.repository");
    await insertBatchRecords({
      sessionId: "s3",
      idempotencyRecordId: "idem-row-5",
      idempotencyKey: "idem-5",
      normalizedPayloadHash: "hash-5",
      stages: [],
      turns: [
        {
          id: "turn-3",
          stageId: "stage-3",
          participantId: "p3",
          sequenceNumber: 1,
          totalScore: 0,
          completedAt: null,
          darts: [
            {
              id: "dart-3",
              dartNumber: 1,
              intendedTargetNumber: null,
              intendedZoneId: null,
              hitTargetNumber: null,
              hitZoneId: 1,
              score: 0,
              locationX: null,
              locationY: null,
            },
          ],
        },
      ],
    });

    const dartsCall = insertCalls.find((call) => call.table === dartsTable);
    expect(dartsCall?.rows[0]).toMatchObject({
      locationX: null,
      locationY: null,
    });
  });
});

describe("findActiveSessionForGameType", () => {
  it("returns the active session summary when one exists", async () => {
    const row = { sessionId: "s1", startedAt: "2026-07-22T10:00:00.000Z" };
    const db = { select: vi.fn(() => fakeSelect([row])) } as any;
    const { findActiveSessionForGameType } =
      await import("@repositories/session.repository");
    const result = await findActiveSessionForGameType(db, "p1", "gt1");
    expect(result).toEqual(row);
  });

  it("returns undefined when no active session exists", async () => {
    const db = { select: vi.fn(() => fakeSelect([])) } as any;
    const { findActiveSessionForGameType } =
      await import("@repositories/session.repository");
    expect(await findActiveSessionForGameType(db, "p1", "gt1")).toBeUndefined();
  });
});

describe("updateSessionStatusRecord", () => {
  it("issues a single update against the plain HTTP db client", async () => {
    const whereMock = vi.fn().mockResolvedValue(undefined);
    const setMock = vi.fn(() => ({ where: whereMock }));
    const db = { update: vi.fn(() => ({ set: setMock })) } as any;
    const { updateSessionStatusRecord } =
      await import("@repositories/session.repository");
    await updateSessionStatusRecord(db, "s1", 2, "2026-07-16T00:00:00.000Z");
    expect(setMock).toHaveBeenCalledWith({
      statusId: 2,
      completedAt: "2026-07-16T00:00:00.000Z",
    });
  });
});

describe("findActiveSessions projection", () => {
  it("selects DTO columns and never player_id", async () => {
    const selectMock = vi.fn(() => fakeSelect([{ sessionId: "s1" }]));
    const db = { select: selectMock } as any;
    const { findActiveSessions } =
      await import("@repositories/session.repository");
    await findActiveSessions(db, "p1");
    const projection = (selectMock.mock.calls as unknown[][])[0]![0] as Record<
      string,
      unknown
    >;
    expect(projection).not.toHaveProperty("playerId");
    expect(Object.keys(projection).sort()).toEqual(
      [
        "captureModeKey",
        "gameTypeKey",
        "gameTypeName",
        "inputModeKey",
        "rulesetVersionKey",
        "sessionId",
        "startedAt",
      ].sort(),
    );
  });
});

describe("findConfigurationPresets projection", () => {
  it("selects DTO columns and never player_id", async () => {
    const selectMock = vi.fn(() =>
      fakeSelect([{ configurationTemplateId: "c1" }]),
    );
    const db = { select: selectMock } as any;
    const { findConfigurationPresets } =
      await import("@repositories/session.repository");
    await findConfigurationPresets(db, "SCORE_TRAINING", "p1");
    const projection = (selectMock.mock.calls as unknown[][])[0]![0] as Record<
      string,
      unknown
    >;
    expect(projection).not.toHaveProperty("playerId");
    expect(Object.keys(projection).sort()).toEqual(
      [
        "configuration",
        "configurationTemplateId",
        "description",
        "gameTypeKey",
        "isSystemTemplate",
        "name",
      ].sort(),
    );
  });
});
