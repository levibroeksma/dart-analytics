import { describe, expect, it } from "vitest";
import {
  StartTrainingRequest,
  StartTrainingResponse,
  StartTrainingStepRequest,
  StartTrainingStepResponse,
  CompleteTrainingResponse,
  AbandonTrainingResponse,
} from "@routes/training-sessions/types";

describe("StartTrainingRequest", () => {
  it("accepts a routineTemplateName", () => {
    expect(
      StartTrainingRequest.safeParse({
        routineTemplateName: "Balanced Training",
      }).success,
    ).toBe(true);
  });

  it("rejects a missing routineTemplateName", () => {
    expect(StartTrainingRequest.safeParse({}).success).toBe(false);
  });
});

describe("StartTrainingResponse", () => {
  it("accepts a resolved step list", () => {
    expect(
      StartTrainingResponse.safeParse({
        activityId: "act-1",
        routineName: "Balanced Training",
        steps: [
          {
            sequenceNumber: 1,
            exerciseTypeKey: "WARM_UP",
            exerciseRulesetVersionKey: "WARM_UP_V1",
            gameTypeKey: null,
            durationSeconds: 600,
            configuration: { stepDurationSeconds: 600 },
          },
        ],
      }).success,
    ).toBe(true);
  });

  it("rejects an unknown exerciseTypeKey", () => {
    expect(
      StartTrainingResponse.safeParse({
        activityId: "act-1",
        routineName: "Balanced Training",
        steps: [
          {
            sequenceNumber: 1,
            exerciseTypeKey: "UNKNOWN",
            exerciseRulesetVersionKey: null,
            gameTypeKey: null,
            durationSeconds: 600,
            configuration: {},
          },
        ],
      }).success,
    ).toBe(false);
  });
});

describe("StartTrainingStepRequest", () => {
  it("accepts an empty body", () => {
    expect(StartTrainingStepRequest.safeParse({}).success).toBe(true);
  });

  it("rejects an unexpected field", () => {
    expect(StartTrainingStepRequest.safeParse({ extra: true }).success).toBe(
      false,
    );
  });
});

describe("StartTrainingStepResponse", () => {
  it("accepts a GAME step's response", () => {
    expect(
      StartTrainingStepResponse.safeParse({
        sessionId: "s1",
        exerciseTypeKey: "GAME",
        configuration: { starting_target: 41 },
        participant: { ref: "pt1", displayName: "Levi" },
        gameTypeKey: "TUOD",
        rulesetVersionKey: "TUOD_V1",
        captureModeKey: "ANALYTICS",
        inputModeKey: "VISUAL_BOARD",
      }).success,
    ).toBe(true);
  });

  it("accepts a non-game step's response with no gameTypeKey", () => {
    expect(
      StartTrainingStepResponse.safeParse({
        sessionId: "s1",
        exerciseTypeKey: "WARM_UP",
        configuration: {},
        participant: { ref: "pt1", displayName: "Levi" },
      }).success,
    ).toBe(true);
  });
});

describe("CompleteTrainingResponse", () => {
  it("accepts an activityId and completedAt", () => {
    expect(
      CompleteTrainingResponse.safeParse({
        activityId: "act-1",
        completedAt: "2026-09-12T12:00:00.000Z",
      }).success,
    ).toBe(true);
  });
});

describe("AbandonTrainingResponse", () => {
  it("accepts an activityId and completedAt", () => {
    expect(
      AbandonTrainingResponse.safeParse({
        activityId: "act-1",
        completedAt: "2026-09-13T12:00:00.000Z",
      }).success,
    ).toBe(true);
  });
});
