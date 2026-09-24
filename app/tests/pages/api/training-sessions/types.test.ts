import { describe, expect, it } from "vitest";
import {
  StartTrainingRequest,
  StartTrainingResponse,
  StartTrainingStepRequest,
  StartTrainingStepResponse,
  CompleteTrainingResponse,
  AbandonTrainingResponse,
  TrainingCompletionsQuery,
  TrainingCompletionListResponse,
} from "@routes/training-sessions/types";

describe("StartTrainingRequest", () => {
  it("accepts a routineTemplateId", () => {
    expect(
      StartTrainingRequest.safeParse({ routineTemplateId: "rt-1" }).success,
    ).toBe(true);
  });

  it("rejects a missing routineTemplateId", () => {
    expect(StartTrainingRequest.safeParse({}).success).toBe(false);
  });

  it("rejects the retired routineTemplateName key", () => {
    expect(
      StartTrainingRequest.safeParse({ routineTemplateName: "x" }).success,
    ).toBe(false);
  });
});

describe("StartTrainingResponse", () => {
  it("accepts a resolved step list", () => {
    expect(
      StartTrainingResponse.safeParse({
        activityId: "act-1",
        routineTemplateId: "rt-1",
        routineName: "Balanced Training",
        steps: [
          {
            sequenceNumber: 1,
            exerciseTypeKey: "WARM_UP",
            exerciseRulesetVersionKey: "WARM_UP_V1",
            gameTypeKey: null,
            gameRulesetVersionKey: null,
            durationSeconds: 600,
            configuration: { stepDurationSeconds: 600 },
          },
        ],
      }).success,
    ).toBe(true);
  });

  it("accepts a TARGET_SCORING step", () => {
    expect(
      StartTrainingResponse.safeParse({
        activityId: "act-1",
        routineTemplateId: "rt-1",
        routineName: "Custom",
        steps: [
          {
            sequenceNumber: 1,
            exerciseTypeKey: "TARGET_SCORING",
            exerciseRulesetVersionKey: "TARGET_SCORING_V1",
            gameTypeKey: null,
            gameRulesetVersionKey: null,
            durationSeconds: 600,
            configuration: { targets: [20, 19, 18, 25] },
          },
        ],
      }).success,
    ).toBe(true);
  });

  it("accepts a SWITCHING_TARGET_SCORING step", () => {
    expect(
      StartTrainingResponse.safeParse({
        activityId: "act-1",
        routineTemplateId: "rt-1",
        routineName: "Custom",
        steps: [
          {
            sequenceNumber: 1,
            exerciseTypeKey: "SWITCHING_TARGET_SCORING",
            exerciseRulesetVersionKey: "SWITCHING_TARGET_SCORING_V1",
            gameTypeKey: null,
            gameRulesetVersionKey: null,
            durationSeconds: 600,
            configuration: { targets: [20, 19, 18] },
          },
        ],
      }).success,
    ).toBe(true);
  });

  it("accepts a SCORE_THRESHOLD step", () => {
    expect(
      StartTrainingResponse.safeParse({
        activityId: "act-1",
        routineTemplateId: "rt-1",
        routineName: "Custom",
        steps: [
          {
            sequenceNumber: 1,
            exerciseTypeKey: "SCORE_THRESHOLD",
            exerciseRulesetVersionKey: "SCORE_THRESHOLD_V1",
            gameTypeKey: null,
            gameRulesetVersionKey: null,
            durationSeconds: 600,
            configuration: { threshold: 65 },
          },
        ],
      }).success,
    ).toBe(true);
  });

  it("accepts a BULLSEYE_CHECKOUT step", () => {
    expect(
      StartTrainingResponse.safeParse({
        activityId: "act-1",
        routineTemplateId: "rt-1",
        routineName: "Custom",
        steps: [
          {
            sequenceNumber: 1,
            exerciseTypeKey: "BULLSEYE_CHECKOUT",
            exerciseRulesetVersionKey: "BULLSEYE_CHECKOUT_V1",
            gameTypeKey: null,
            gameRulesetVersionKey: null,
            durationSeconds: 600,
            configuration: { startScore: 81 },
          },
        ],
      }).success,
    ).toBe(true);
  });

  it("accepts a BULL_UP step", () => {
    expect(
      StartTrainingResponse.safeParse({
        activityId: "act-1",
        routineTemplateId: "rt-1",
        routineName: "Custom",
        steps: [
          {
            sequenceNumber: 1,
            exerciseTypeKey: "BULL_UP",
            exerciseRulesetVersionKey: "BULL_UP_V1",
            gameTypeKey: null,
            gameRulesetVersionKey: null,
            durationSeconds: 300,
            configuration: {},
          },
        ],
      }).success,
    ).toBe(true);
  });

  it("rejects an unknown exerciseTypeKey", () => {
    expect(
      StartTrainingResponse.safeParse({
        activityId: "act-1",
        routineTemplateId: "rt-1",
        routineName: "Balanced Training",
        steps: [
          {
            sequenceNumber: 1,
            exerciseTypeKey: "UNKNOWN",
            exerciseRulesetVersionKey: null,
            gameTypeKey: null,
            gameRulesetVersionKey: null,
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

  it("accepts a BULL_UP step's response", () => {
    expect(
      StartTrainingStepResponse.safeParse({
        sessionId: "s1",
        exerciseTypeKey: "BULL_UP",
        configuration: {},
        participant: { ref: "pt1", displayName: "Levi" },
        captureModeKey: "ANALYTICS",
        inputModeKey: "VISUAL_BOARD",
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

describe("TrainingCompletionsQuery", () => {
  it("accepts an ISO instant with offset", () => {
    expect(
      TrainingCompletionsQuery.safeParse({
        since: "2026-09-22T00:00:00+02:00",
      }).success,
    ).toBe(true);
  });

  it("rejects a missing or non-ISO since", () => {
    expect(TrainingCompletionsQuery.safeParse({}).success).toBe(false);
    expect(TrainingCompletionsQuery.safeParse({ since: "today" }).success).toBe(
      false,
    );
  });
});

describe("TrainingCompletionListResponse", () => {
  it("accepts a list of completions", () => {
    expect(
      TrainingCompletionListResponse.safeParse({
        items: [
          {
            activityId: "act-1",
            routineTemplateId: "rt-1",
            routineName: "Balanced Training",
            completedAt: "2026-09-22T08:00:00.000Z",
          },
        ],
        nextCursor: null,
      }).success,
    ).toBe(true);
  });
});
