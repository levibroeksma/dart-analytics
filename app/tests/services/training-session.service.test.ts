import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@db/client", () => ({ getDb: vi.fn(() => ({})) }));
vi.mock("@lib/id", () => ({ generateId: vi.fn(() => "generated-id") }));
vi.mock("@repositories/training-session.repository", () => ({
  findRoutineTemplateSteps: vi.fn(),
  insertTrainingActivity: vi.fn(),
}));
vi.mock("@repositories/session.repository", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@repositories/session.repository")>();
  return { ...actual, findGameStatusId: vi.fn() };
});

import * as trainingRepo from "@repositories/training-session.repository";
import * as sessionRepo from "@repositories/session.repository";
import { startTraining } from "@services/training-session.service";

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
