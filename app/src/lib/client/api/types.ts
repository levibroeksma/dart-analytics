import type {
  CompletionSeriesResponseData,
  SessionResultSeriesResponseData,
  VolumeSeriesResponseData,
} from "@routes/types";

export type ApiErrorBody = {
  code: string;
  message: string;
  retryable: boolean;
  details?: Record<string, unknown>;
};

export type ApiSuccess<T> = {
  ok: true;
  data: T;
  requestId: string;
};

export type ApiFailure = {
  ok: false;
  error: ApiErrorBody;
  requestId: string;
};

export type ApiResult<T> = ApiSuccess<T> | ApiFailure;

/** The range-request parameters `fetchGameSessions`/`fetchGameSection` build into a query string. */
export type GameStatsRangeParams = {
  from: string;
  to: string;
  bucket?: "none" | "day" | "week" | "month" | "year";
  tz?: string;
  status?: string;
  context?: string;
  inputMode?: string;
};

/** The section response `fetchGameSection` returns, whichever section was requested. */
export type GameSectionResponseData =
  | CompletionSeriesResponseData
  | VolumeSeriesResponseData
  | SessionResultSeriesResponseData;

export {
  ProvisionPlayerRequest,
  type ProvisionPlayerRequestInput,
  type ProvisionPlayerResponseData,
  type ErrorCode,
  CreateSessionRequest,
  type CreateSessionRequestInput,
  type CreateSessionResponseData,
  type EventsBatchRequestInput,
  type BatchWriteResponseData,
  // fallow-ignore-next-line unused-type -- two-barrel Worker/browser convention (03-Shared-Conventions.md); kept for a future browser consumer of PATCH session status
  type UpdateSessionRequestInput,
  type SessionActiveData,
  type ConfigurationPresetData,
  UpdatePlayerSettingsRequest,
  type UpdatePlayerSettingsInput,
  type PlayerSettingsResponseData,
  UpdatePlayerProfileRequest,
  type UpdatePlayerProfileInput,
  type PlayerProfileResponseData,
  type StatisticsOverviewResponseData,
  type GameSessionListResponseData,
  type CompletionSeriesResponseData,
  type VolumeSeriesResponseData,
  type SessionResultSeriesResponseData,
  StartTrainingRequest,
  type StartTrainingRequestInput,
  type StartTrainingResponseData,
  type StartTrainingStepResponseData,
  type CompleteTrainingResponseData,
  type AbandonTrainingResponseData,
  type TrainingCompletionListData,
  CreateRoutineRequest,
  type CreateRoutineRequestInput,
  UpdateRoutineRequest,
  type UpdateRoutineRequestInput,
  type RoutineExecutionData,
  type RoutineSummaryData,
  type RoutineListData,
  type ExerciseTemplateCatalogEntryData,
  CreateScheduleRequest,
  type CreateScheduleRequestInput,
  UpdateScheduleRequest,
  type UpdateScheduleRequestInput,
  type ScheduleData,
  type ScheduleSummaryData,
  type ScheduleListData,
} from "@routes/types";
