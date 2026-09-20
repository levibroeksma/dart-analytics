import { z } from "zod";

/** Inclusive cap on a schedule's trimmed name length. */
export const MAX_SCHEDULE_NAME_LENGTH = 60;

/** ISO weekday and the routine (or rest) assigned to it; a weekday absent from `days` is rest. */
export const ScheduleDayInput = z.object({
  dayOfWeek: z.number().int().min(1).max(7),
  routineTemplateId: z.string().min(1),
});

export const CreateScheduleRequest = z.object({
  name: z.string().trim().min(1).max(MAX_SCHEDULE_NAME_LENGTH),
  days: z.array(ScheduleDayInput).max(7),
});
export type CreateScheduleRequestInput = z.infer<typeof CreateScheduleRequest>;

export const UpdateScheduleRequest = CreateScheduleRequest;
export type UpdateScheduleRequestInput = z.infer<typeof UpdateScheduleRequest>;

export const ScheduleDay = z.object({
  dayOfWeek: z.number().int(),
  routineId: z.string(),
  routineName: z.string(),
  routineMinutes: z.number().int(),
});

export const ScheduleResponse = z.object({
  scheduleId: z.string(),
  name: z.string(),
  isActive: z.boolean(),
  days: z.array(ScheduleDay),
});
export type ScheduleData = z.infer<typeof ScheduleResponse>;

export const ScheduleSummary = z.object({
  scheduleId: z.string(),
  name: z.string(),
  isActive: z.boolean(),
  dayCount: z.number().int(),
});
export type ScheduleSummaryData = z.infer<typeof ScheduleSummary>;

export const ScheduleListResponse = z.object({
  items: z.array(ScheduleSummary),
  nextCursor: z.null(),
});
export type ScheduleListData = z.infer<typeof ScheduleListResponse>;
