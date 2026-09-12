import { z } from "zod";

export const StartTrainingRequest = z.object({
  routineTemplateName: z.string(),
});
export type StartTrainingRequestInput = z.infer<typeof StartTrainingRequest>;

const TrainingStepResolved = z.object({
  sequenceNumber: z.number().int(),
  exerciseTypeKey: z.enum(["WARM_UP", "SWITCHING", "DOUBLE_PATTERN", "GAME"]),
  exerciseRulesetVersionKey: z.string().nullable(),
  gameTypeKey: z.string().nullable(),
  durationSeconds: z.number().int(),
  configuration: z.record(z.unknown()),
});

export const StartTrainingResponse = z.object({
  activityId: z.string(),
  routineName: z.string(),
  steps: z.array(TrainingStepResolved),
});
export type StartTrainingResponseData = z.infer<typeof StartTrainingResponse>;

export const StartTrainingStepRequest = z.object({}).strict();
export type StartTrainingStepRequestInput = z.infer<
  typeof StartTrainingStepRequest
>;

export const StartTrainingStepResponse = z.object({
  sessionId: z.string(),
  exerciseTypeKey: z.enum(["WARM_UP", "SWITCHING", "DOUBLE_PATTERN", "GAME"]),
  configuration: z.record(z.unknown()),
  participant: z.object({ ref: z.string(), displayName: z.string() }),
  gameTypeKey: z.string().optional(),
  rulesetVersionKey: z.string().optional(),
  captureModeKey: z.string().optional(),
  inputModeKey: z.string().optional(),
});
export type StartTrainingStepResponseData = z.infer<
  typeof StartTrainingStepResponse
>;

export const CompleteTrainingResponse = z.object({
  activityId: z.string(),
  completedAt: z.string(),
});
export type CompleteTrainingResponseData = z.infer<
  typeof CompleteTrainingResponse
>;
