import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@db/client", () => ({
  getDb: vi.fn(() => ({})),
  withTransaction: vi.fn((fn: (tx: unknown) => unknown) => fn({ tx: true })),
}));
vi.mock("@lib/id", () => {
  let n = 0;
  return { generateId: vi.fn(() => `id-${++n}`) };
});
vi.mock("@repositories/routine.repository", () => ({
  findRoutineExecutionRows: vi.fn(),
  findExerciseTemplateCatalog: vi.fn(),
  findDurationTypeId: vi.fn(),
  insertRoutineTemplateRecord: vi.fn(),
  insertRoutineStepRecords: vi.fn(),
  updateRoutineTemplateRecord: vi.fn(),
  deleteRoutineStepRecords: vi.fn(),
  deleteRoutineTemplateRecord: vi.fn(),
}));

import * as repo from "@repositories/routine.repository";
import { withTransaction } from "@db/client";
import {
  listRoutines,
  getRoutine,
  createRoutine,
  replaceRoutine,
  deleteRoutine,
  listExerciseTemplates,
} from "@services/routine.service";

const CATALOG = [
  {
    exerciseTemplateId: "et-warm",
    name: "Warm-Up",
    description: null,
    exerciseTypeKey: "WARM_UP",
    gameTypeKey: null,
    hasDefaultConfiguration: true,
  },
  {
    exerciseTemplateId: "et-sw",
    name: "Switching",
    description: null,
    exerciseTypeKey: "SWITCHING",
    gameTypeKey: null,
    hasDefaultConfiguration: true,
  },
  {
    exerciseTemplateId: "et-fin",
    name: "Finishing",
    description: null,
    exerciseTypeKey: "GAME",
    gameTypeKey: "TUOD",
    hasDefaultConfiguration: true,
  },
  {
    exerciseTemplateId: "et-nodef",
    name: "Bare",
    description: null,
    exerciseTypeKey: "SWITCHING",
    gameTypeKey: null,
    hasDefaultConfiguration: false,
  },
];

function row(over: Partial<Record<string, unknown>>) {
  return {
    routineId: "rt-sys",
    routineName: "Balanced Training",
    routineDescription: "d",
    isSystemTemplate: true,
    playerId: null,
    sequenceNumber: 1,
    exerciseTemplateId: "et-warm",
    exerciseName: "Warm-Up",
    exerciseDescription: "loosen",
    exerciseTypeKey: "WARM_UP",
    exerciseRulesetVersionKey: "WARM_UP_V1",
    gameTypeKey: null,
    durationTypeKey: "MINUTES",
    durationValue: 10,
    defaultConfiguration: {},
    stepConfiguration: null,
    ...over,
  };
}

const VALID = {
  name: "  Mine  ",
  description: null,
  steps: [
    {
      exerciseTemplateId: "et-warm",
      durationTypeKey: "MINUTES" as const,
      durationValue: 10,
    },
    {
      exerciseTemplateId: "et-sw",
      durationTypeKey: "MINUTES" as const,
      durationValue: 10,
    },
    {
      exerciseTemplateId: "et-fin",
      durationTypeKey: "MINUTES" as const,
      durationValue: 10,
    },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(repo.findExerciseTemplateCatalog).mockResolvedValue(CATALOG);
  vi.mocked(repo.findDurationTypeId).mockResolvedValue(2);
});

describe("listRoutines", () => {
  it("groups view rows into summaries with derived totalMinutes and stepCount", async () => {
    vi.mocked(repo.findRoutineExecutionRows).mockResolvedValue([
      row({}),
      row({ sequenceNumber: 2, exerciseTemplateId: "et-sw", durationValue: 5 }),
      row({
        routineId: "rt-own",
        routineName: "Mine",
        isSystemTemplate: false,
        playerId: "p1",
        durationValue: 30,
      }),
    ] as never);
    const result = await listRoutines("p1");
    expect(result).toEqual({
      ok: true,
      data: {
        items: [
          {
            routineId: "rt-sys",
            routineName: "Balanced Training",
            description: "d",
            isSystemTemplate: true,
            stepCount: 2,
            totalMinutes: 15,
          },
          {
            routineId: "rt-own",
            routineName: "Mine",
            description: "d",
            isSystemTemplate: false,
            stepCount: 1,
            totalMinutes: 30,
          },
        ],
        nextCursor: null,
      },
    });
    expect(repo.findRoutineExecutionRows).toHaveBeenCalledWith(
      expect.anything(),
      "p1",
    );
  });
});

describe("getRoutine", () => {
  it("returns NOT_FOUND when the view yields nothing (unknown or foreign)", async () => {
    vi.mocked(repo.findRoutineExecutionRows).mockResolvedValue([]);
    expect(await getRoutine("p1", "rt-x")).toEqual({
      ok: false,
      code: "NOT_FOUND",
      details: { routineId: "rt-x" },
    });
  });

  it("returns the routine with ordered steps", async () => {
    vi.mocked(repo.findRoutineExecutionRows).mockResolvedValue([
      row({}),
    ] as never);
    const result = await getRoutine("p1", "rt-sys");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.steps[0]).toEqual({
      sequenceNumber: 1,
      exerciseTemplateId: "et-warm",
      exerciseName: "Warm-Up",
      exerciseDescription: "loosen",
      exerciseTypeKey: "WARM_UP",
      gameTypeKey: null,
      durationValue: 10,
      durationTypeKey: "MINUTES",
    });
  });
});

describe("listExerciseTemplates", () => {
  it("drops templates without a default configuration and the has_* flag", async () => {
    const result = await listExerciseTemplates();
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.map((e) => e.exerciseTemplateId)).toEqual([
      "et-warm",
      "et-sw",
      "et-fin",
    ]);
    expect(result.data[0]).not.toHaveProperty("hasDefaultConfiguration");
  });
});

describe("createRoutine", () => {
  it("rejects an unknown or default-less template with the step index", async () => {
    const result = await createRoutine("p1", {
      ...VALID,
      steps: [
        {
          exerciseTemplateId: "et-nodef",
          durationTypeKey: "MINUTES",
          durationValue: 30,
        },
      ],
    });
    expect(result).toEqual({
      ok: false,
      code: "VALIDATION_FAILED",
      details: { reason: "unknown exerciseTemplateId", step: 1 },
    });
  });

  it("rejects a total under the floor with the module's issues", async () => {
    const result = await createRoutine("p1", {
      ...VALID,
      steps: [
        {
          exerciseTemplateId: "et-sw",
          durationTypeKey: "MINUTES",
          durationValue: 20,
        },
      ],
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("VALIDATION_FAILED");
    expect(
      String((result.details as { issues: string[] }).issues[0]),
    ).toContain("minimum is 30");
  });

  it("rejects a GAME step outside TUOD's timed bounds", async () => {
    const result = await createRoutine("p1", {
      ...VALID,
      steps: [
        {
          exerciseTemplateId: "et-sw",
          durationTypeKey: "MINUTES",
          durationValue: 28,
        },
        {
          exerciseTemplateId: "et-fin",
          durationTypeKey: "MINUTES",
          durationValue: 2,
        },
      ],
    });
    expect(result).toEqual({
      ok: false,
      code: "VALIDATION_FAILED",
      details: {
        reason: "game step minutes out of bounds",
        step: 2,
        min: 3,
        max: 30,
      },
    });
  });

  it("inserts template then steps in one transaction and reads the routine back", async () => {
    vi.mocked(repo.findRoutineExecutionRows).mockResolvedValue([
      row({
        routineId: "id-1",
        routineName: "Mine",
        isSystemTemplate: false,
        playerId: "p1",
      }),
    ] as never);
    const result = await createRoutine("p1", VALID);
    expect(result.ok).toBe(true);
    expect(withTransaction).toHaveBeenCalledTimes(1);
    expect(repo.insertRoutineTemplateRecord).toHaveBeenCalledWith(
      { tx: true },
      { routineId: "id-1", playerId: "p1", name: "Mine", description: null },
    );
    expect(repo.insertRoutineStepRecords).toHaveBeenCalledWith(
      { tx: true },
      expect.objectContaining({
        routineId: "id-1",
        durationTypeId: 2,
        steps: [
          { id: "id-2", exerciseTemplateId: "et-warm", durationValue: 10 },
          { id: "id-3", exerciseTemplateId: "et-sw", durationValue: 10 },
          { id: "id-4", exerciseTemplateId: "et-fin", durationValue: 10 },
        ],
      }),
    );
    expect(repo.findRoutineExecutionRows).toHaveBeenCalledWith(
      expect.anything(),
      "p1",
      "id-1",
    );
  });

  it("maps the 0038 trigger's check_violation to VALIDATION_FAILED", async () => {
    const err = Object.assign(new Error("bound"), {
      code: "23514",
      constraint: "trg_routine_templates_duration_bounds",
    });
    vi.mocked(withTransaction).mockRejectedValueOnce(err);
    const result = await createRoutine("p1", VALID);
    expect(result).toEqual({
      ok: false,
      code: "VALIDATION_FAILED",
      details: { reason: "routine duration out of bounds" },
    });
  });
});

describe("replaceRoutine", () => {
  it("returns NOT_FOUND for a routine the caller cannot see", async () => {
    vi.mocked(repo.findRoutineExecutionRows).mockResolvedValue([]);
    expect(await replaceRoutine("p1", "rt-x", VALID)).toEqual({
      ok: false,
      code: "NOT_FOUND",
      details: { routineId: "rt-x" },
    });
  });

  it("refuses a system routine as read-only", async () => {
    vi.mocked(repo.findRoutineExecutionRows).mockResolvedValue([
      row({}),
    ] as never);
    expect(await replaceRoutine("p1", "rt-sys", VALID)).toEqual({
      ok: false,
      code: "VALIDATION_FAILED",
      details: { reason: "system routine is read-only" },
    });
  });

  it("updates, deletes steps, then inserts steps inside one transaction", async () => {
    vi.mocked(repo.findRoutineExecutionRows).mockResolvedValue([
      row({ routineId: "rt-own", isSystemTemplate: false, playerId: "p1" }),
    ] as never);
    vi.mocked(repo.updateRoutineTemplateRecord).mockResolvedValue(true);
    const result = await replaceRoutine("p1", "rt-own", VALID);
    expect(result.ok).toBe(true);
    const order = [
      vi.mocked(repo.updateRoutineTemplateRecord).mock.invocationCallOrder[0],
      vi.mocked(repo.deleteRoutineStepRecords).mock.invocationCallOrder[0],
      vi.mocked(repo.insertRoutineStepRecords).mock.invocationCallOrder[0],
    ];
    expect(order).toEqual([...order].sort((a, b) => a - b));
    expect(withTransaction).toHaveBeenCalledTimes(1);
  });

  it("does not write steps when the ownership-checked update reports false", async () => {
    vi.mocked(repo.findRoutineExecutionRows).mockResolvedValue([
      row({ routineId: "rt-own", isSystemTemplate: false, playerId: "p1" }),
    ] as never);
    vi.mocked(repo.updateRoutineTemplateRecord).mockResolvedValue(false);
    const result = await replaceRoutine("p1", "rt-own", VALID);
    expect(result).toEqual({
      ok: false,
      code: "NOT_FOUND",
      details: { routineId: "rt-own" },
    });
    expect(repo.deleteRoutineStepRecords).not.toHaveBeenCalled();
    expect(repo.insertRoutineStepRecords).not.toHaveBeenCalled();
  });
});

describe("deleteRoutine", () => {
  it("refuses a system routine", async () => {
    vi.mocked(repo.findRoutineExecutionRows).mockResolvedValue([
      row({}),
    ] as never);
    expect(await deleteRoutine("p1", "rt-sys")).toEqual({
      ok: false,
      code: "VALIDATION_FAILED",
      details: { reason: "system routine is read-only" },
    });
  });

  it("deletes an own routine", async () => {
    vi.mocked(repo.findRoutineExecutionRows).mockResolvedValue([
      row({ routineId: "rt-own", isSystemTemplate: false, playerId: "p1" }),
    ] as never);
    vi.mocked(repo.deleteRoutineTemplateRecord).mockResolvedValue(true);
    expect(await deleteRoutine("p1", "rt-own")).toEqual({
      ok: true,
      data: null,
    });
    expect(repo.deleteRoutineTemplateRecord).toHaveBeenCalledWith(
      expect.anything(),
      "rt-own",
      "p1",
    );
  });
});
