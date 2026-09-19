import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderingDb, onlyStatement } from "./render-sql";

function predicateColumns(clause: unknown): string[] {
  const names: string[] = [];
  const visit = (node: unknown) => {
    if (!node || typeof node !== "object") return;
    const candidate = node as { name?: unknown; queryChunks?: unknown[] };
    if (typeof candidate.name === "string") names.push(candidate.name);
    if (Array.isArray(candidate.queryChunks))
      candidate.queryChunks.forEach(visit);
  };
  visit(clause);
  return names;
}

function fakeSelect(rows: unknown[]) {
  const chain = {
    from: vi.fn().mockReturnThis(),
    innerJoin: vi.fn().mockReturnThis(),
    leftJoin: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockResolvedValue(rows),
    limit: vi.fn().mockResolvedValue(rows),
  };
  return chain;
}

describe("findRoutineTemplateSteps", () => {
  it("filters by routine id and (system OR own) and returns the routine name", async () => {
    const { db, statements } = renderingDb([]);
    const { findRoutineTemplateSteps } =
      await import("@repositories/training-session.repository");
    await findRoutineTemplateSteps(db, "rt-1", "p1");
    const sql = onlyStatement(statements);
    expect(sql).toContain('"routine_id" = $1');
    expect(sql).toMatch(/"is_system_template" = \$2 or .*"player_id" = \$3/);
    expect(statements[0].params).toEqual(["rt-1", true, "p1"]);
  });

  it("returns undefined when the routine has no visible rows", async () => {
    const { db } = renderingDb([]);
    const { findRoutineTemplateSteps } =
      await import("@repositories/training-session.repository");
    expect(await findRoutineTemplateSteps(db, "rt-1", "p1")).toBeUndefined();
  });

  /**
   * `renderingDb` runs the real pg-proxy query builder (see its own doc
   * comment), which maps each row positionally against the `.select({...})`
   * field order — not by key name — so the seeded row is a tuple in that
   * order, not a snake_case-keyed object.
   */
  it("shapes rows into { routineTemplateId, routineName, steps }", async () => {
    const { db } = renderingDb([
      [
        "rt-1",
        "Mine",
        1,
        "WARM_UP",
        "WARM_UP_V1",
        null,
        "MINUTES",
        10,
        {},
        null,
      ],
    ]);
    const { findRoutineTemplateSteps } =
      await import("@repositories/training-session.repository");
    const result = await findRoutineTemplateSteps(db, "rt-1", "p1");
    expect(result).toMatchObject({
      routineTemplateId: "rt-1",
      routineName: "Mine",
    });
    expect(result?.steps[0]).toMatchObject({
      sequenceNumber: 1,
      exerciseTypeKey: "WARM_UP",
    });
  });
});

const insertedValuesByTable = new Map<unknown, unknown>();
vi.mock("@db/client", () => ({
  withTransaction: vi.fn(async (fn: (tx: unknown) => unknown) => {
    const tx = {
      insert: (table: unknown) => ({
        values: (values: unknown) => {
          insertedValuesByTable.set(table, values);
          return Promise.resolve();
        },
      }),
    };
    return fn(tx);
  }),
}));

describe("insertTrainingActivity", () => {
  beforeEach(() => {
    insertedValuesByTable.clear();
  });

  it("inserts one activities row and one activity_configurations row", async () => {
    const { insertTrainingActivity } =
      await import("@repositories/training-session.repository");
    const { activities, activityConfigurations } = await import("@db/schema");
    const tx = {
      insert: (table: unknown) => ({
        values: (values: unknown) => {
          insertedValuesByTable.set(table, values);
          return Promise.resolve();
        },
      }),
    } as any;
    await insertTrainingActivity(tx, {
      activityId: "act-1",
      playerId: "p1",
      activeStatusId: 1,
      configurationId: "cfg-1",
      configuration: { routineName: "Balanced Training", steps: [] },
    });
    expect((insertedValuesByTable.get(activities) as { id?: string }).id).toBe(
      "act-1",
    );
    expect(
      (
        insertedValuesByTable.get(activityConfigurations) as {
          activityId?: string;
        }
      ).activityId,
    ).toBe("act-1");
  });
});

describe("findActivityConfiguration", () => {
  it("returns the stored snapshot's configuration", async () => {
    const snapshot = { routineName: "Balanced Training", steps: [] };
    const db = {
      select: vi.fn(() => fakeSelect([{ configuration: snapshot }])),
    } as any;
    const { findActivityConfiguration } =
      await import("@repositories/training-session.repository");
    const result = await findActivityConfiguration(db, "act-1", "p1");
    expect(result).toEqual(snapshot);
  });

  it("scopes the lookup to the owning player", async () => {
    const chain = fakeSelect([]);
    const db = { select: vi.fn(() => chain) } as any;
    const { findActivityConfiguration } =
      await import("@repositories/training-session.repository");
    await findActivityConfiguration(db, "act-1", "p1");
    expect(chain.innerJoin).toHaveBeenCalled();
    expect(predicateColumns(chain.where.mock.calls[0]![0])).toContain(
      "player_id",
    );
  });

  it("returns undefined when the activity has no snapshot", async () => {
    const db = { select: vi.fn(() => fakeSelect([])) } as any;
    const { findActivityConfiguration } =
      await import("@repositories/training-session.repository");
    const result = await findActivityConfiguration(db, "unknown", "p1");
    expect(result).toBeUndefined();
  });
});

describe("findActivityStatus", () => {
  it("returns the current status id for the owning player", async () => {
    const db = { select: vi.fn(() => fakeSelect([{ statusId: 2 }])) } as any;
    const { findActivityStatus } =
      await import("@repositories/training-session.repository");
    expect(await findActivityStatus(db, "act-1", "p1")).toEqual({
      statusId: 2,
    });
  });

  it("returns undefined when the activity is not the caller's", async () => {
    const chain = fakeSelect([]);
    const db = { select: vi.fn(() => chain) } as any;
    const { findActivityStatus } =
      await import("@repositories/training-session.repository");
    expect(
      await findActivityStatus(db, "act-1", "someone-else"),
    ).toBeUndefined();
    expect(predicateColumns(chain.where.mock.calls[0]![0])).toContain(
      "player_id",
    );
  });
});

function fakeUpdate(rows: unknown[]) {
  const chain = {
    set: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue(rows),
  };
  return chain;
}

describe("updateActivityStatusRecord", () => {
  it("marks the activity completed and returns the new completedAt", async () => {
    const db = {
      update: vi.fn(() =>
        fakeUpdate([
          { activityId: "act-1", completedAt: "2026-09-12T12:00:00.000Z" },
        ]),
      ),
    } as any;
    const { updateActivityStatusRecord } =
      await import("@repositories/training-session.repository");
    const result = await updateActivityStatusRecord(db, {
      activityId: "act-1",
      playerId: "p1",
      statusId: 2,
      expectedStatusId: 1,
    });
    expect(result).toEqual({
      activityId: "act-1",
      completedAt: "2026-09-12T12:00:00.000Z",
    });
  });

  it("filters the update on the expected current status", async () => {
    const chain = fakeUpdate([]);
    const db = { update: vi.fn(() => chain) } as any;
    const { updateActivityStatusRecord } =
      await import("@repositories/training-session.repository");
    await updateActivityStatusRecord(db, {
      activityId: "act-1",
      playerId: "p1",
      statusId: 3,
      expectedStatusId: 1,
    });
    const columns = predicateColumns(chain.where.mock.calls[0]![0]);
    expect(columns).toContain("player_id");
    expect(columns).toContain("status_id");
  });

  it("returns undefined when no activity matches the player", async () => {
    const db = { update: vi.fn(() => fakeUpdate([])) } as any;
    const { updateActivityStatusRecord } =
      await import("@repositories/training-session.repository");
    const result = await updateActivityStatusRecord(db, {
      activityId: "act-1",
      playerId: "someone-else",
      statusId: 2,
      expectedStatusId: 1,
    });
    expect(result).toBeUndefined();
  });
});

describe("abandonActiveTrainingActivities", () => {
  beforeEach(() => vi.clearAllMocks());

  it("closes the player's open training activities and their open sessions", async () => {
    const activityUpdate = fakeUpdate([{ activityId: "act-old" }]);
    const sessionUpdate = fakeUpdate([{ sessionId: "sess-old" }]);
    let call = 0;
    const tx = {
      update: vi.fn(() => (call++ === 0 ? activityUpdate : sessionUpdate)),
    } as any;
    const { abandonActiveTrainingActivities } =
      await import("@repositories/training-session.repository");
    const result = await abandonActiveTrainingActivities(tx, {
      playerId: "p1",
      abandonedStatusId: 3,
    });
    expect(result).toEqual(["act-old"]);
    expect(activityUpdate.set).toHaveBeenCalledWith(
      expect.objectContaining({ statusId: 3 }),
    );
    expect(sessionUpdate.set).toHaveBeenCalledWith(
      expect.objectContaining({ statusId: 3 }),
    );
  });

  it("leaves sessions untouched when the player has no open training activity", async () => {
    const activityUpdate = fakeUpdate([]);
    const sessionUpdate = fakeUpdate([]);
    let call = 0;
    const tx = {
      update: vi.fn(() => (call++ === 0 ? activityUpdate : sessionUpdate)),
    } as any;
    const { abandonActiveTrainingActivities } =
      await import("@repositories/training-session.repository");
    const result = await abandonActiveTrainingActivities(tx, {
      playerId: "p1",
      abandonedStatusId: 3,
    });
    expect(result).toEqual([]);
    expect(sessionUpdate.set).not.toHaveBeenCalled();
  });
});

/**
 * Rendered-statement coverage for this repository's write paths. The mocked
 * `tx` above never renders SQL, so a malformed predicate passes it unnoticed —
 * an `exists` over a raw `sql` chunk emitted `exists select 1 ...` without the
 * parentheses Postgres requires, and every routine start failed 42601 in
 * production (#400). `renderingDb` runs the real builder (issue #397).
 */
describe("training-session.repository rendered SQL", () => {
  it("parenthesises the activity_configurations EXISTS subquery", async () => {
    const { db, statements } = renderingDb();
    const { abandonActiveTrainingActivities } =
      await import("@repositories/training-session.repository");
    await abandonActiveTrainingActivities(db, {
      playerId: "p1",
      abandonedStatusId: 3,
    });
    expect(onlyStatement(statements)).toBe(
      'update "activities" set "status_id" = $1, "completed_at" = $2 where ("activities"."player_id" = $3 and "activities"."completed_at" is null and exists (select 1 from "activity_configurations" where "activity_configurations"."activity_id" = "activities"."id")) returning "id"',
    );
  });

  it("renders the activity status update scoped to owner and expected status", async () => {
    const { db, statements } = renderingDb([
      ["a1", "2026-01-01T00:00:00.000Z"],
    ]);
    const { updateActivityStatusRecord } =
      await import("@repositories/training-session.repository");
    await updateActivityStatusRecord(db, {
      activityId: "a1",
      playerId: "p1",
      statusId: 3,
      expectedStatusId: 1,
    });
    expect(onlyStatement(statements)).toBe(
      'update "activities" set "status_id" = $1, "completed_at" = $2 where ("activities"."id" = $3 and "activities"."player_id" = $4 and "activities"."status_id" = $5) returning "id", "completed_at"',
    );
  });

  it("renders the activity and its configuration snapshot as two inserts", async () => {
    const { db, statements } = renderingDb();
    const { insertTrainingActivity } =
      await import("@repositories/training-session.repository");
    await insertTrainingActivity(db, {
      activityId: "a1",
      playerId: "p1",
      activeStatusId: 1,
      configurationId: "c1",
      configuration: { routineName: "Balanced Training", steps: [] },
    });
    expect(statements.map((statement) => statement.sql)).toEqual([
      'insert into "activities" ("id", "player_id", "status_id", "started_at", "completed_at", "created_at") values ($1, $2, $3, $4, default, $5)',
      'insert into "activity_configurations" ("id", "activity_id", "configuration", "created_at") values ($1, $2, $3, $4)',
    ]);
  });
});
