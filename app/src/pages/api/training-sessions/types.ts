import { z } from "zod";

export const StartTrainingRequest = z.object({
  routineTemplateId: z.string().min(1),
});
export type StartTrainingRequestInput = z.infer<typeof StartTrainingRequest>;

const TrainingStepResolved = z.object({
  sequenceNumber: z.number().int(),
  exerciseTypeKey: z.enum([
    "WARM_UP",
    "SWITCHING",
    "DOUBLE_PATTERN",
    "TARGET_SCORING",
    "SWITCHING_TARGET_SCORING",
    "SCORE_THRESHOLD",
    "BULLSEYE_CHECKOUT",
    "GAME",
  ]),
  exerciseRulesetVersionKey: z.string().nullable(),
  gameTypeKey: z.string().nullable(),
  gameRulesetVersionKey: z.string().nullable(),
  durationSeconds: z.number().int(),
  configuration: z.record(z.unknown()),
});

export const StartTrainingResponse = z.object({
  activityId: z.string(),
  routineTemplateId: z.string(),
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
  exerciseTypeKey: z.enum([
    "WARM_UP",
    "SWITCHING",
    "DOUBLE_PATTERN",
    "TARGET_SCORING",
    "SWITCHING_TARGET_SCORING",
    "SCORE_THRESHOLD",
    "BULLSEYE_CHECKOUT",
    "GAME",
  ]),
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

export const AbandonTrainingResponse = z.object({
  activityId: z.string(),
  completedAt: z.string(),
});
export type AbandonTrainingResponseData = z.infer<
  typeof AbandonTrainingResponse
>;

/** `GET /api/training-sessions/completed` query: completions at or after `since`. */
export const TrainingCompletionsQuery = z.object({
  since: z.string().datetime({ offset: true }),
});
export type TrainingCompletionsQueryInput = z.infer<
  typeof TrainingCompletionsQuery
>;

export const TrainingCompletion = z.object({
  activityId: z.string(),
  routineTemplateId: z.string(),
  routineName: z.string(),
  completedAt: z.string(),
});

export const TrainingCompletionListResponse = z.object({
  items: z.array(TrainingCompletion),
  nextCursor: z.null(),
});
export type TrainingCompletionListData = z.infer<
  typeof TrainingCompletionListResponse
>;
