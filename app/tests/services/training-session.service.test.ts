import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@db/client", () => ({
  getDb: vi.fn(() => ({})),
  withTransaction: vi.fn((fn: (tx: unknown) => unknown) => fn({})),
}));
vi.mock("@lib/id", () => ({ generateId: vi.fn(() => "generated-id") }));
vi.mock("@repositories/training-session.repository", () => ({
  findRoutineTemplateSteps: vi.fn(),
  insertTrainingActivity: vi.fn(),
  findActivityConfiguration: vi.fn(),
  findActivityStatus: vi.fn(),
  updateActivityStatusRecord: vi.fn(),
  abandonActiveTrainingActivities: vi.fn(),
}));
vi.mock("@repositories/session.repository", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@repositories/session.repository")>();
  return {
    ...actual,
    findGameStatusId: vi.fn(),
    findExerciseTypeId: vi.fn(),
    findExerciseRulesetVersionId: vi.fn(),
    findGameTypeAndRuleset: vi.fn(),
    findCaptureModeId: vi.fn(),
    findInputModeId: vi.fn(),
    findParticipantTypeId: vi.fn(),
    findPlayerDisplayName: vi.fn(),
    insertExerciseSessionRecord: vi.fn(),
    findActiveSessionForGameType: vi.fn(),
    findActiveSessionForExerciseType: vi.fn(),
  };
});

import * as trainingRepo from "@repositories/training-session.repository";
import * as sessionRepo from "@repositories/session.repository";
import {
  startTraining,
  startTrainingStep,
  completeTraining,
  abandonTraining,
} from "@services/training-session.service";

const RESOLVED = {
  routineTemplateId: "rt-1",
  routineName: "Balanced Training",
  steps: [
    {
      sequenceNumber: 1,
      exerciseTypeKey: "WARM_UP",
      exerciseRulesetVersionKey: "WARM_UP_V1",
      gameTypeKey: null,
      gameRulesetVersionKey: null,
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
      gameRulesetVersionKey: "TUOD_V1",
      durationTypeKey: "MINUTES",
      durationValue: 10,
      // The Finishing template's own default_configuration (seed `0020`).
      defaultConfiguration: {
        starting_target: 41,
        finish_bonus: 10,
        miss_penalty: 1,
        duration_type: "MINUTES",
        duration_value: 10,
        max_darts_per_turn: 3,
      },
      stepConfiguration: null,
    },
  ],
};

describe("startTraining", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns VALIDATION_FAILED when the routineTemplateId has no visible routine", async () => {
    vi.mocked(trainingRepo.findRoutineTemplateSteps).mockResolvedValue(
      undefined,
    );
    const result = await startTraining("p1", "rt-1");
    expect(result).toEqual({
      ok: false,
      code: "VALIDATION_FAILED",
      details: { reason: "unknown routineTemplateId" },
    });
    expect(trainingRepo.findRoutineTemplateSteps).toHaveBeenCalledWith(
      expect.anything(),
      "rt-1",
      "p1",
    );
  });

  it("resolves steps, injects stepDurationSeconds for WARM_UP, and creates the activity", async () => {
    vi.mocked(trainingRepo.findRoutineTemplateSteps).mockResolvedValue(
      RESOLVED as any,
    );
    vi.mocked(sessionRepo.findGameStatusId).mockResolvedValue(1);
    const result = await startTraining("p1", "rt-1");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.activityId).toBe("generated-id");
    expect(result.data.routineName).toBe("Balanced Training");
    expect(result.data.steps[0]).toMatchObject({
      exerciseTypeKey: "WARM_UP",
      durationSeconds: 600,
      configuration: {
        stepDurationSeconds: 600,
        phases: RESOLVED.steps[0].defaultConfiguration!.phases,
      },
    });
    expect(result.data.steps[1]).toMatchObject({
      exerciseTypeKey: "GAME",
      gameTypeKey: "TUOD",
      configuration: {
        starting_target: 41,
        duration_type: "MINUTES",
        duration_value: 10,
      },
    });
    expect(result.data.routineTemplateId).toBe("rt-1");
    expect(trainingRepo.insertTrainingActivity).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ activityId: "generated-id", playerId: "p1" }),
    );
    expect(trainingRepo.insertTrainingActivity).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        configuration: expect.objectContaining({
          routineTemplateId: "rt-1",
          routineName: "Balanced Training",
        }),
      }),
    );
  });

  it("abandons the player's open training activity before inserting the new one", async () => {
    vi.mocked(trainingRepo.findRoutineTemplateSteps).mockResolvedValue(
      RESOLVED as any,
    );
    vi.mocked(sessionRepo.findGameStatusId).mockImplementation(
      async (_db: unknown, key: string) =>
        ({ ACTIVE: 1, COMPLETED: 2, ABANDONED: 3 })[key],
    );
    vi.mocked(trainingRepo.abandonActiveTrainingActivities).mockResolvedValue([
      "act-old",
    ]);

    const result = await startTraining("p1", "rt-1");

    expect(result.ok).toBe(true);
    expect(trainingRepo.abandonActiveTrainingActivities).toHaveBeenCalledWith(
      expect.anything(),
      { playerId: "p1", abandonedStatusId: 3 },
    );
    const abandonOrder = vi.mocked(trainingRepo.abandonActiveTrainingActivities)
      .mock.invocationCallOrder[0];
    const insertOrder = vi.mocked(trainingRepo.insertTrainingActivity).mock
      .invocationCallOrder[0];
    expect(abandonOrder).toBeLessThan(insertOrder);
  });

  it("returns INTERNAL_ERROR when the ABANDONED status is missing", async () => {
    vi.mocked(trainingRepo.findRoutineTemplateSteps).mockResolvedValue(
      RESOLVED as any,
    );
    vi.mocked(sessionRepo.findGameStatusId).mockImplementation(
      async (_db: unknown, key: string) => (key === "ACTIVE" ? 1 : undefined),
    );

    const result = await startTraining("p1", "rt-1");

    expect(result).toEqual({
      ok: false,
      code: "INTERNAL_ERROR",
      details: { reason: "reference data missing" },
    });
    expect(trainingRepo.insertTrainingActivity).not.toHaveBeenCalled();
  });

  it("rejects a step whose merged configuration fails its exercise ruleset", async () => {
    vi.mocked(trainingRepo.findRoutineTemplateSteps).mockResolvedValue({
      routineTemplateId: "rt-1",
      steps: [
        {
          ...RESOLVED.steps[0],
          sequenceNumber: 2,
          exerciseTypeKey: "SWITCHING",
          exerciseRulesetVersionKey: "SWITCHING_V1",
          defaultConfiguration: { targets: [20], scoring: { single: 1 } },
        },
      ],
    } as any);
    vi.mocked(sessionRepo.findGameStatusId).mockResolvedValue(1);

    const result = await startTraining("p1", "rt-1");

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("VALIDATION_FAILED");
    expect(result.details).toMatchObject({
      reason: "invalid step configuration",
      steps: [{ sequenceNumber: 2 }],
    });
    expect(trainingRepo.insertTrainingActivity).not.toHaveBeenCalled();
  });

  it("reports the step's own overrides, not just the template default", async () => {
    vi.mocked(trainingRepo.findRoutineTemplateSteps).mockResolvedValue({
      routineTemplateId: "rt-1",
      steps: [
        {
          ...RESOLVED.steps[0],
          stepConfiguration: { phases: [] },
        },
      ],
    } as any);
    vi.mocked(sessionRepo.findGameStatusId).mockResolvedValue(1);

    const result = await startTraining("p1", "rt-1");

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("VALIDATION_FAILED");
  });

  /**
   * The #338 gap, caught at the service boundary: migration 0035 leaves
   * exercise_ruleset_version_id nullable, so a template the backfill missed
   * reaches here with no version key at all.
   */
  it("rejects a non-game step that pins no exercise ruleset version", async () => {
    vi.mocked(trainingRepo.findRoutineTemplateSteps).mockResolvedValue({
      routineTemplateId: "rt-1",
      steps: [{ ...RESOLVED.steps[0], exerciseRulesetVersionKey: null }],
    } as any);
    vi.mocked(sessionRepo.findGameStatusId).mockResolvedValue(1);

    const result = await startTraining("p1", "rt-1");

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("VALIDATION_FAILED");
    expect(result.details).toMatchObject({
      steps: [
        { sequenceNumber: 1, issues: [expect.stringContaining("unpinned")] },
      ],
    });
    expect(trainingRepo.insertTrainingActivity).not.toHaveBeenCalled();
  });

  it("rejects a non-game step whose ruleset version has no registered validator", async () => {
    vi.mocked(trainingRepo.findRoutineTemplateSteps).mockResolvedValue({
      routineTemplateId: "rt-1",
      steps: [
        { ...RESOLVED.steps[0], exerciseRulesetVersionKey: "WARM_UP_V2" },
      ],
    } as any);
    vi.mocked(sessionRepo.findGameStatusId).mockResolvedValue(1);

    const result = await startTraining("p1", "rt-1");

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.details).toMatchObject({
      steps: [{ issues: [expect.stringContaining("WARM_UP_V2")] }],
    });
  });

  /**
   * `WarmUpV1Config` is `.strict()` and `stepDurationSeconds` is deliberately
   * not one of its keys, so validating the finished object rather than the
   * merge would reject every Warm-Up step ever written.
   */
  it("validates the merged configuration before stepDurationSeconds is injected", async () => {
    vi.mocked(trainingRepo.findRoutineTemplateSteps).mockResolvedValue(
      RESOLVED as any,
    );
    vi.mocked(sessionRepo.findGameStatusId).mockResolvedValue(1);

    const result = await startTraining("p1", "rt-1");

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.steps[0].configuration).toMatchObject({
      stepDurationSeconds: 600,
    });
  });

  it("injects the step's minutes into a GAME step's duration keys", async () => {
    vi.mocked(trainingRepo.findRoutineTemplateSteps).mockResolvedValue({
      ...RESOLVED,
      steps: [{ ...RESOLVED.steps[1], durationValue: 15 }],
    } as any);
    vi.mocked(sessionRepo.findGameStatusId).mockResolvedValue(1);
    const result = await startTraining("p1", "rt-1");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.steps[0].configuration).toMatchObject({
      duration_type: "MINUTES",
      duration_value: 15,
    });
  });

  it("refuses a GAME step whose ruleset is not routine-eligible", async () => {
    vi.mocked(trainingRepo.findRoutineTemplateSteps).mockResolvedValue({
      ...RESOLVED,
      steps: [
        {
          ...RESOLVED.steps[1],
          gameTypeKey: "501",
          gameRulesetVersionKey: "501_V1",
          defaultConfiguration: {},
        },
      ],
    } as any);
    vi.mocked(sessionRepo.findGameStatusId).mockResolvedValue(1);
    expect(await startTraining("p1", "rt-1")).toMatchObject({
      ok: false,
      code: "VALIDATION_FAILED",
      details: {
        reason: "game not routine-eligible",
        steps: [{ sequenceNumber: 4 }],
      },
    });
  });

  it("validates a Score Training step with its own ruleset", async () => {
    vi.mocked(trainingRepo.findRoutineTemplateSteps).mockResolvedValue({
      ...RESOLVED,
      steps: [
        {
          ...RESOLVED.steps[1],
          gameTypeKey: "SCORE_TRAINING",
          gameRulesetVersionKey: "SCORE_TRAINING_V1",
          defaultConfiguration: {
            duration_type: "MINUTES",
            duration_value: 10,
            max_darts_per_turn: 3,
            max_visit_score: 180,
          },
          durationValue: 8,
        },
      ],
    } as any);
    vi.mocked(sessionRepo.findGameStatusId).mockResolvedValue(1);
    const result = await startTraining("p1", "rt-1");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.steps[0]).toMatchObject({
      gameRulesetVersionKey: "SCORE_TRAINING_V1",
      configuration: { duration_value: 8 },
    });
  });

  it("refuses a GAME step whose merged configuration fails its ruleset (issue #392)", async () => {
    vi.mocked(trainingRepo.findRoutineTemplateSteps).mockResolvedValue({
      ...RESOLVED,
      steps: [
        { ...RESOLVED.steps[1], defaultConfiguration: { starting_target: 41 } },
      ],
    } as any);
    vi.mocked(sessionRepo.findGameStatusId).mockResolvedValue(1);
    const result = await startTraining("p1", "rt-1");
    expect(result).toMatchObject({
      ok: false,
      code: "VALIDATION_FAILED",
      details: {
        reason: "invalid step configuration",
        steps: [{ sequenceNumber: 4 }],
      },
    });
  });
});

const SNAPSHOT = {
  routineName: "Balanced Training",
  steps: [
    {
      sequenceNumber: 1,
      exerciseTypeKey: "WARM_UP",
      exerciseRulesetVersionKey: "WARM_UP_V1",
      gameTypeKey: null,
      gameRulesetVersionKey: null,
      durationSeconds: 600,
      configuration: { stepDurationSeconds: 600, phases: [] },
    },
    {
      sequenceNumber: 2,
      exerciseTypeKey: "SWITCHING",
      exerciseRulesetVersionKey: "SWITCHING_V1",
      gameTypeKey: null,
      gameRulesetVersionKey: null,
      durationSeconds: 300,
      configuration: { targets: [20, 19, 18] },
    },
    {
      sequenceNumber: 4,
      exerciseTypeKey: "GAME",
      exerciseRulesetVersionKey: null,
      gameTypeKey: "SCORE_TRAINING",
      gameRulesetVersionKey: "SCORE_TRAINING_V1",
      durationSeconds: 600,
      configuration: { starting_target: 41 },
    },
  ],
};

// startTrainingStep was split into startGameStep/startNonGameStep/
// resolveActiveSessionConflict helpers to clear npx fallow's complexity
// gate; these cases still exercise the exported function end to end and
// all pass unchanged, confirming the split carries no behavior change.
describe("startTrainingStep", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns VALIDATION_FAILED for an out-of-range sequenceNumber", async () => {
    vi.mocked(trainingRepo.findActivityConfiguration).mockResolvedValue(
      SNAPSHOT as any,
    );
    const result = await startTrainingStep("p1", "act-1", 99);
    expect(result).toEqual({
      ok: false,
      code: "VALIDATION_FAILED",
      details: { reason: "unknown sequenceNumber" },
    });
  });

  it("reads the configuration snapshot scoped to the calling player", async () => {
    vi.mocked(trainingRepo.findActivityConfiguration).mockResolvedValue(
      SNAPSHOT as any,
    );
    await startTrainingStep("p1", "act-1", 99);
    expect(trainingRepo.findActivityConfiguration).toHaveBeenCalledWith(
      expect.anything(),
      "act-1",
      "p1",
    );
  });

  it("returns SESSION_OWNERSHIP_MISMATCH when the activity is not the caller's", async () => {
    vi.mocked(trainingRepo.findActivityConfiguration).mockResolvedValue(
      undefined,
    );
    const result = await startTrainingStep("intruder", "act-1", 1);
    expect(result).toEqual({
      ok: false,
      code: "SESSION_OWNERSHIP_MISMATCH",
      details: { activityId: "act-1" },
    });
    expect(sessionRepo.insertExerciseSessionRecord).not.toHaveBeenCalled();
  });

  it("inserts a non-game exercise session for WARM_UP", async () => {
    vi.mocked(trainingRepo.findActivityConfiguration).mockResolvedValue(
      SNAPSHOT as any,
    );
    vi.mocked(sessionRepo.findGameStatusId).mockResolvedValue(1);
    vi.mocked(sessionRepo.findExerciseTypeId).mockResolvedValue("et-warmup");
    vi.mocked(sessionRepo.findExerciseRulesetVersionId).mockResolvedValue(
      "erv-1",
    );
    vi.mocked(sessionRepo.findParticipantTypeId).mockResolvedValue(2);
    vi.mocked(sessionRepo.findPlayerDisplayName).mockResolvedValue("Levi");
    vi.mocked(sessionRepo.insertExerciseSessionRecord).mockResolvedValue({
      sessionId: "generated-id",
    });

    const result = await startTrainingStep("p1", "act-1", 1);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.exerciseTypeKey).toBe("WARM_UP");
    expect(sessionRepo.insertExerciseSessionRecord).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        activityId: "act-1",
        exerciseTypeId: "et-warmup",
        exerciseRulesetVersionId: "erv-1",
        routineStepSequenceNumber: 1,
        captureModeId: undefined,
        inputModeId: undefined,
      }),
    );
  });

  it("inserts SWITCHING under the ANALYTICS/VISUAL_BOARD capture pair", async () => {
    vi.mocked(trainingRepo.findActivityConfiguration).mockResolvedValue(
      SNAPSHOT as any,
    );
    vi.mocked(sessionRepo.findGameStatusId).mockResolvedValue(1);
    vi.mocked(sessionRepo.findExerciseTypeId).mockResolvedValue("et-switching");
    vi.mocked(sessionRepo.findExerciseRulesetVersionId).mockResolvedValue(
      "erv-switching",
    );
    vi.mocked(sessionRepo.findCaptureModeId).mockResolvedValue(3);
    vi.mocked(sessionRepo.findInputModeId).mockResolvedValue(4);
    vi.mocked(sessionRepo.findParticipantTypeId).mockResolvedValue(2);
    vi.mocked(sessionRepo.findPlayerDisplayName).mockResolvedValue("Levi");
    vi.mocked(sessionRepo.insertExerciseSessionRecord).mockResolvedValue({
      sessionId: "generated-id",
    });

    const result = await startTrainingStep("p1", "act-1", 2);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(sessionRepo.findCaptureModeId).toHaveBeenCalledWith(
      expect.anything(),
      "ANALYTICS",
    );
    expect(sessionRepo.findInputModeId).toHaveBeenCalledWith(
      expect.anything(),
      "VISUAL_BOARD",
    );
    expect(sessionRepo.insertExerciseSessionRecord).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        exerciseRulesetVersionId: "erv-switching",
        captureModeId: 3,
        inputModeId: 4,
      }),
    );
  });

  it("inserts a GAME exercise session for Score Training, resolving SCORE_TRAINING_V1", async () => {
    vi.mocked(trainingRepo.findActivityConfiguration).mockResolvedValue(
      SNAPSHOT as any,
    );
    vi.mocked(sessionRepo.findGameStatusId).mockResolvedValue(1);
    vi.mocked(sessionRepo.findExerciseTypeId).mockResolvedValue("et-game");
    vi.mocked(sessionRepo.findGameTypeAndRuleset).mockResolvedValue({
      gameTypeId: "gt-score",
      rulesetVersionId: "rv-score-1",
    });
    vi.mocked(sessionRepo.findCaptureModeId).mockResolvedValue(1);
    vi.mocked(sessionRepo.findInputModeId).mockResolvedValue(1);
    vi.mocked(sessionRepo.findParticipantTypeId).mockResolvedValue(2);
    vi.mocked(sessionRepo.findPlayerDisplayName).mockResolvedValue("Levi");
    vi.mocked(sessionRepo.insertExerciseSessionRecord).mockResolvedValue({
      sessionId: "generated-id",
    });

    const result = await startTrainingStep("p1", "act-1", 4);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.gameTypeKey).toBe("SCORE_TRAINING");
    expect(result.data.rulesetVersionKey).toBe("SCORE_TRAINING_V1");
    expect(sessionRepo.findGameTypeAndRuleset).toHaveBeenCalledWith(
      expect.anything(),
      "SCORE_TRAINING",
      "SCORE_TRAINING_V1",
    );
  });

  it("refuses a GAME step whose snapshot ruleset is not routine-eligible, before any lookup", async () => {
    vi.mocked(trainingRepo.findActivityConfiguration).mockResolvedValue({
      ...SNAPSHOT,
      steps: [
        {
          ...SNAPSHOT.steps[2],
          gameTypeKey: "501",
          gameRulesetVersionKey: "501_V1",
        },
      ],
    } as any);
    vi.mocked(sessionRepo.findGameStatusId).mockResolvedValue(1);
    vi.mocked(sessionRepo.findParticipantTypeId).mockResolvedValue(2);
    vi.mocked(sessionRepo.findPlayerDisplayName).mockResolvedValue("Levi");

    const result = await startTrainingStep("p1", "act-1", 4);

    expect(result).toEqual({
      ok: false,
      code: "VALIDATION_FAILED",
      details: { reason: "game not routine-eligible" },
    });
    expect(sessionRepo.findGameTypeAndRuleset).not.toHaveBeenCalled();
    expect(sessionRepo.insertExerciseSessionRecord).not.toHaveBeenCalled();
  });

  it("returns SESSION_ALREADY_ACTIVE when the Score Training insert hits the unique-active conflict", async () => {
    vi.mocked(trainingRepo.findActivityConfiguration).mockResolvedValue(
      SNAPSHOT as any,
    );
    vi.mocked(sessionRepo.findGameStatusId).mockResolvedValue(1);
    vi.mocked(sessionRepo.findExerciseTypeId).mockResolvedValue("et-game");
    vi.mocked(sessionRepo.findGameTypeAndRuleset).mockResolvedValue({
      gameTypeId: "gt-score",
      rulesetVersionId: "rv-score-1",
    });
    vi.mocked(sessionRepo.findCaptureModeId).mockResolvedValue(1);
    vi.mocked(sessionRepo.findInputModeId).mockResolvedValue(1);
    vi.mocked(sessionRepo.findParticipantTypeId).mockResolvedValue(2);
    vi.mocked(sessionRepo.findPlayerDisplayName).mockResolvedValue("Levi");
    vi.mocked(sessionRepo.insertExerciseSessionRecord).mockRejectedValue({
      code: "23505",
      constraint: "uq_sessions_single_active",
    });
    vi.mocked(sessionRepo.findActiveSessionForGameType).mockResolvedValue({
      sessionId: "active-1",
      startedAt: "2026-09-12T00:00:00Z",
    });

    const result = await startTrainingStep("p1", "act-1", 4);
    expect(result).toMatchObject({
      ok: false,
      code: "SESSION_ALREADY_ACTIVE",
      details: { sessionId: "active-1" },
    });
  });

  it("returns SESSION_ALREADY_ACTIVE when a non-game step hits the unique-active conflict", async () => {
    vi.mocked(trainingRepo.findActivityConfiguration).mockResolvedValue(
      SNAPSHOT as any,
    );
    vi.mocked(sessionRepo.findGameStatusId).mockResolvedValue(1);
    vi.mocked(sessionRepo.findExerciseTypeId).mockResolvedValue("et-switching");
    vi.mocked(sessionRepo.findExerciseRulesetVersionId).mockResolvedValue(
      "erv-switching",
    );
    vi.mocked(sessionRepo.findCaptureModeId).mockResolvedValue(3);
    vi.mocked(sessionRepo.findInputModeId).mockResolvedValue(4);
    vi.mocked(sessionRepo.findParticipantTypeId).mockResolvedValue(2);
    vi.mocked(sessionRepo.findPlayerDisplayName).mockResolvedValue("Levi");
    vi.mocked(sessionRepo.insertExerciseSessionRecord).mockRejectedValue({
      code: "23505",
      constraint: "uq_sessions_single_active",
    });
    vi.mocked(sessionRepo.findActiveSessionForExerciseType).mockResolvedValue({
      sessionId: "active-switching",
      startedAt: "2026-09-16T00:00:00Z",
    });

    const result = await startTrainingStep("p1", "act-1", 2);

    expect(result).toMatchObject({
      ok: false,
      code: "SESSION_ALREADY_ACTIVE",
      details: { sessionId: "active-switching" },
    });
    expect(sessionRepo.findActiveSessionForExerciseType).toHaveBeenCalledWith(
      expect.anything(),
      "p1",
      "et-switching",
    );
  });

  it("rethrows a non-conflict failure from a non-game step insert", async () => {
    vi.mocked(trainingRepo.findActivityConfiguration).mockResolvedValue(
      SNAPSHOT as any,
    );
    vi.mocked(sessionRepo.findGameStatusId).mockResolvedValue(1);
    vi.mocked(sessionRepo.findExerciseTypeId).mockResolvedValue("et-switching");
    vi.mocked(sessionRepo.findExerciseRulesetVersionId).mockResolvedValue(
      "erv-switching",
    );
    vi.mocked(sessionRepo.findCaptureModeId).mockResolvedValue(3);
    vi.mocked(sessionRepo.findInputModeId).mockResolvedValue(4);
    vi.mocked(sessionRepo.findParticipantTypeId).mockResolvedValue(2);
    vi.mocked(sessionRepo.findPlayerDisplayName).mockResolvedValue("Levi");
    vi.mocked(sessionRepo.insertExerciseSessionRecord).mockRejectedValue(
      new Error("connection lost"),
    );

    await expect(startTrainingStep("p1", "act-1", 2)).rejects.toThrow(
      "connection lost",
    );
  });
});

const ACTIVE_STATUS_ID = 1;
const COMPLETED_STATUS_ID = 2;
const ABANDONED_STATUS_ID = 3;

function mockStatusIds() {
  vi.mocked(sessionRepo.findGameStatusId).mockImplementation(
    async (_db: unknown, key: string) =>
      ({
        ACTIVE: ACTIVE_STATUS_ID,
        COMPLETED: COMPLETED_STATUS_ID,
        ABANDONED: ABANDONED_STATUS_ID,
      })[key],
  );
}

describe("completeTraining", () => {
  beforeEach(() => vi.clearAllMocks());

  it("marks the activity completed, guarding on the ACTIVE status", async () => {
    mockStatusIds();
    vi.mocked(trainingRepo.updateActivityStatusRecord).mockResolvedValue({
      activityId: "act-1",
      completedAt: "2026-09-12T12:00:00.000Z",
    });
    const result = await completeTraining("p1", "act-1");
    expect(result).toEqual({
      ok: true,
      data: { activityId: "act-1", completedAt: "2026-09-12T12:00:00.000Z" },
    });
    expect(trainingRepo.updateActivityStatusRecord).toHaveBeenCalledWith(
      expect.anything(),
      {
        activityId: "act-1",
        playerId: "p1",
        statusId: COMPLETED_STATUS_ID,
        expectedStatusId: ACTIVE_STATUS_ID,
      },
    );
  });

  it("returns NOT_FOUND when the activity does not belong to the player", async () => {
    mockStatusIds();
    vi.mocked(trainingRepo.updateActivityStatusRecord).mockResolvedValue(
      undefined,
    );
    vi.mocked(trainingRepo.findActivityStatus).mockResolvedValue(undefined);
    const result = await completeTraining("p1", "act-1");
    expect(result).toEqual({
      ok: false,
      code: "NOT_FOUND",
      details: { activityId: "act-1" },
    });
  });
});

describe("abandonTraining", () => {
  beforeEach(() => vi.clearAllMocks());

  it("marks the activity abandoned", async () => {
    mockStatusIds();
    vi.mocked(trainingRepo.updateActivityStatusRecord).mockResolvedValue({
      activityId: "act-1",
      completedAt: "2026-09-13T12:00:00.000Z",
    });
    const result = await abandonTraining("p1", "act-1");
    expect(result).toEqual({
      ok: true,
      data: { activityId: "act-1", completedAt: "2026-09-13T12:00:00.000Z" },
    });
    expect(sessionRepo.findGameStatusId).toHaveBeenCalledWith(
      expect.anything(),
      "ABANDONED",
    );
    expect(trainingRepo.updateActivityStatusRecord).toHaveBeenCalledWith(
      expect.anything(),
      {
        activityId: "act-1",
        playerId: "p1",
        statusId: ABANDONED_STATUS_ID,
        expectedStatusId: ACTIVE_STATUS_ID,
      },
    );
  });

  it("returns SESSION_ALREADY_COMPLETED when the activity already reached a terminal status", async () => {
    mockStatusIds();
    vi.mocked(trainingRepo.updateActivityStatusRecord).mockResolvedValue(
      undefined,
    );
    vi.mocked(trainingRepo.findActivityStatus).mockResolvedValue({
      statusId: COMPLETED_STATUS_ID,
    });
    const result = await abandonTraining("p1", "act-1");
    expect(result).toEqual({
      ok: false,
      code: "SESSION_ALREADY_COMPLETED",
      details: { activityId: "act-1" },
    });
  });

  it("returns NOT_FOUND when the activity does not belong to the player", async () => {
    mockStatusIds();
    vi.mocked(trainingRepo.updateActivityStatusRecord).mockResolvedValue(
      undefined,
    );
    vi.mocked(trainingRepo.findActivityStatus).mockResolvedValue(undefined);
    const result = await abandonTraining("p1", "act-1");
    expect(result).toEqual({
      ok: false,
      code: "NOT_FOUND",
      details: { activityId: "act-1" },
    });
  });

  it("returns INTERNAL_ERROR when the ABANDONED status lookup is missing", async () => {
    vi.mocked(sessionRepo.findGameStatusId).mockResolvedValue(undefined);
    const result = await abandonTraining("p1", "act-1");
    expect(result).toEqual({
      ok: false,
      code: "INTERNAL_ERROR",
      details: { reason: "reference data missing" },
    });
  });
});
