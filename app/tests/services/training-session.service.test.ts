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
  steps: [
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
  ],
};

describe("startTraining", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns VALIDATION_FAILED when the routine name has no system template", async () => {
    vi.mocked(trainingRepo.findRoutineTemplateSteps).mockResolvedValue(
      undefined,
    );
    const result = await startTraining("p1", "Unknown Routine");
    expect(result).toEqual({
      ok: false,
      code: "VALIDATION_FAILED",
      details: { reason: "unknown routineTemplateName" },
    });
  });

  it("resolves steps, injects stepDurationSeconds for WARM_UP, and creates the activity", async () => {
    vi.mocked(trainingRepo.findRoutineTemplateSteps).mockResolvedValue(
      RESOLVED as any,
    );
    vi.mocked(sessionRepo.findGameStatusId).mockResolvedValue(1);
    const result = await startTraining("p1", "Balanced Training");
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
      configuration: { starting_target: 41 },
    });
    expect(trainingRepo.insertTrainingActivity).toHaveBeenCalledWith(
      expect.objectContaining({ activityId: "generated-id", playerId: "p1" }),
    );
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
      durationSeconds: 600,
      configuration: { stepDurationSeconds: 600, phases: [] },
    },
    {
      sequenceNumber: 2,
      exerciseTypeKey: "SWITCHING",
      exerciseRulesetVersionKey: "SWITCHING_V1",
      gameTypeKey: null,
      durationSeconds: 300,
      configuration: { targets: [20, 19, 18] },
    },
    {
      sequenceNumber: 4,
      exerciseTypeKey: "GAME",
      exerciseRulesetVersionKey: null,
      gameTypeKey: "TUOD",
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

  it("inserts a GAME exercise session for Finishing, resolving TUOD_V1", async () => {
    vi.mocked(trainingRepo.findActivityConfiguration).mockResolvedValue(
      SNAPSHOT as any,
    );
    vi.mocked(sessionRepo.findGameStatusId).mockResolvedValue(1);
    vi.mocked(sessionRepo.findExerciseTypeId).mockResolvedValue("et-game");
    vi.mocked(sessionRepo.findGameTypeAndRuleset).mockResolvedValue({
      gameTypeId: "gt-tuod",
      rulesetVersionId: "rv-tuod-1",
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
    expect(result.data.gameTypeKey).toBe("TUOD");
    expect(result.data.rulesetVersionKey).toBe("TUOD_V1");
    expect(sessionRepo.findGameTypeAndRuleset).toHaveBeenCalledWith(
      expect.anything(),
      "TUOD",
      "TUOD_V1",
    );
  });

  it("returns SESSION_ALREADY_ACTIVE when the Finishing insert hits the unique-active conflict", async () => {
    vi.mocked(trainingRepo.findActivityConfiguration).mockResolvedValue(
      SNAPSHOT as any,
    );
    vi.mocked(sessionRepo.findGameStatusId).mockResolvedValue(1);
    vi.mocked(sessionRepo.findExerciseTypeId).mockResolvedValue("et-game");
    vi.mocked(sessionRepo.findGameTypeAndRuleset).mockResolvedValue({
      gameTypeId: "gt-tuod",
      rulesetVersionId: "rv-tuod-1",
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
