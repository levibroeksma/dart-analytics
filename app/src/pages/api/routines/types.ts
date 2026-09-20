import { z } from "zod";

/** Single step's inclusive minute ceiling; a step can never outrun the routine-wide cap. */
export const MAX_ROUTINE_STEP_MINUTES = 60;

/** Inclusive cap on the number of steps a routine may hold; the builder's own add-step limit mirrors this. */
export const MAX_ROUTINE_STEPS = 12;

/** Inclusive cap on a routine's trimmed name length; the builder's own name field mirrors this. */
export const MAX_ROUTINE_NAME_LENGTH = 60;

/** Phase 1 accepts MINUTES only (06-API/04-Endpoint-Contracts.md, D321). */
export const RoutineStepInput = z.object({
  exerciseTemplateId: z.string().min(1),
  durationTypeKey: z.literal("MINUTES"),
  durationValue: z.number().int().min(1).max(MAX_ROUTINE_STEP_MINUTES),
});

export const CreateRoutineRequest = z.object({
  name: z.string().trim().min(1).max(MAX_ROUTINE_NAME_LENGTH),
  description: z.string().trim().max(280).nullable().default(null),
  steps: z.array(RoutineStepInput).min(1).max(MAX_ROUTINE_STEPS),
});
export type CreateRoutineRequestInput = z.infer<typeof CreateRoutineRequest>;

export const UpdateRoutineRequest = CreateRoutineRequest;
export type UpdateRoutineRequestInput = z.infer<typeof UpdateRoutineRequest>;

export const RoutineStep = z.object({
  sequenceNumber: z.number().int(),
  exerciseTemplateId: z.string(),
  exerciseName: z.string(),
  exerciseDescription: z.string().nullable(),
  exerciseTypeKey: z.string(),
  gameTypeKey: z.string().nullable(),
  gameRulesetVersionKey: z.string().nullable(),
  durationValue: z.number().int(),
  durationTypeKey: z.string(),
});

export const RoutineExecutionResponse = z.object({
  routineId: z.string(),
  routineName: z.string(),
  description: z.string().nullable(),
  isSystemTemplate: z.boolean(),
  steps: z.array(RoutineStep),
});
export type RoutineExecutionData = z.infer<typeof RoutineExecutionResponse>;

export const RoutineSummary = z.object({
  routineId: z.string(),
  routineName: z.string(),
  description: z.string().nullable(),
  isSystemTemplate: z.boolean(),
  stepCount: z.number().int(),
  totalMinutes: z.number().int(),
});
export type RoutineSummaryData = z.infer<typeof RoutineSummary>;

export const RoutineListResponse = z.object({
  items: z.array(RoutineSummary),
  nextCursor: z.null(),
});
export type RoutineListData = z.infer<typeof RoutineListResponse>;
