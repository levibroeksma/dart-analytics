import { describe, it, expect, vi, beforeEach } from "vitest";

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
  it("returns undefined when no system routine matches the name", async () => {
    const db = { select: vi.fn(() => fakeSelect([])) } as any;
    const { findRoutineTemplateSteps } =
      await import("@repositories/training-session.repository");
    const result = await findRoutineTemplateSteps(db, "Unknown Routine");
    expect(result).toBeUndefined();
  });

  it("returns the routine id and its resolved steps in sequence order", async () => {
    const templateRow = [{ id: "rt-1" }];
    const stepRows = [
      {
        sequenceNumber: 1,
        exerciseTypeKey: "WARM_UP",
        exerciseRulesetVersionKey: "WARM_UP_V1",
        gameTypeKey: null,
        durationTypeKey: "MINUTES",
        durationValue: 10,
        defaultConfiguration: {
          phases: [{ name: "Upper", targets: [5], weight: 1 }],
        },
        stepConfiguration: null,
      },
      {
        sequenceNumber: 4,
        exerciseTypeKey: "GAME",
        exerciseRulesetVersionKey: null,
        gameTypeKey: "TUOD",
        durationTypeKey: "MINUTES",
        durationValue: 10,
        defaultConfiguration: null,
        stepConfiguration: { starting_target: 41 },
      },
    ];
    let call = 0;
    const db = {
      select: vi.fn(() => fakeSelect(call++ === 0 ? templateRow : stepRows)),
    } as any;
    const { findRoutineTemplateSteps } =
      await import("@repositories/training-session.repository");
    const result = await findRoutineTemplateSteps(db, "Balanced Training");
    expect(result?.routineTemplateId).toBe("rt-1");
    expect(result?.steps).toHaveLength(2);
    expect(result?.steps[1].gameTypeKey).toBe("TUOD");
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
    await insertTrainingActivity({
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
