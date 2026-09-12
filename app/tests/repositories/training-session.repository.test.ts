import { describe, it, expect, vi, beforeEach } from "vitest";

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
    const result = await findActivityConfiguration(db, "act-1");
    expect(result).toEqual(snapshot);
  });

  it("returns undefined when the activity has no snapshot", async () => {
    const db = { select: vi.fn(() => fakeSelect([])) } as any;
    const { findActivityConfiguration } =
      await import("@repositories/training-session.repository");
    const result = await findActivityConfiguration(db, "unknown");
    expect(result).toBeUndefined();
  });
});
