import type {
  BustRateSeriesResponseData,
  CheckoutPathSeriesResponseData,
  CheckoutRateSeriesResponseData,
  CompletionSeriesResponseData,
  ConfusionSeriesResponseData,
  DoublePerformanceSeriesResponseData,
  GroupingSeriesResponseData,
  HeatmapSeriesResponseData,
  LadderProgressSeriesResponseData,
  LegStatsSeriesResponseData,
  LooseDartsSeriesResponseData,
  MissDirectionSeriesResponseData,
  RoutineCompletionSeriesResponseData,
  RoutineVolumeSeriesResponseData,
  ScoringTrendSeriesResponseData,
  SessionResultSeriesResponseData,
  StepResultSeriesResponseData,
  StepVolumeSeriesResponseData,
  TargetAccuracySeriesResponseData,
  TrebleRateSeriesResponseData,
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
  target?: string;
};

/** `fetchSessionReplay`'s params: `cursor`/`limit` are omitted from the query when absent, letting the server default `limit`. */
export type ReplaySessionParams = {
  cursor?: string;
  limit?: number;
};

/** The section response `fetchGameSection` returns, whichever section was requested. */
export type GameSectionResponseData =
  | CompletionSeriesResponseData
  | VolumeSeriesResponseData
  | SessionResultSeriesResponseData
  | TargetAccuracySeriesResponseData
  | ConfusionSeriesResponseData
  | GroupingSeriesResponseData
  | MissDirectionSeriesResponseData
  | LooseDartsSeriesResponseData
  | HeatmapSeriesResponseData
  | ScoringTrendSeriesResponseData
  | LadderProgressSeriesResponseData
  | CheckoutRateSeriesResponseData
  | DoublePerformanceSeriesResponseData
  | CheckoutPathSeriesResponseData
  | BustRateSeriesResponseData
  | LegStatsSeriesResponseData
  | TrebleRateSeriesResponseData;

/** The range/bucket/status parameters a routine or routine-step section request builds — `GameStatsRangeParams` minus `context`, `inputMode` and `target`, which `RoutineStatsQuery`'s `.strict()` never accepts (D372 decision 4), so the two shapes cannot drift apart. */
export type RoutineSectionParams = Omit<
  GameStatsRangeParams,
  "context" | "inputMode" | "target"
>;

/** `fetchRoutineStepSessions`'s params: `RoutineSessionsQuery`'s own fields — no `bucket`/`tz`/`context`/`inputMode` (D372 decision 4). */
export type RoutineStepSessionsParams = {
  from: string;
  to: string;
  status?: string;
  limit?: number;
  cursor?: string;
};

/** The response `fetchRoutineSection` returns: one of the routine's own two run-level sections. */
export type RoutineSectionResponseData =
  RoutineVolumeSeriesResponseData | RoutineCompletionSeriesResponseData;

/** The response `fetchRoutineStepSection` returns: a GAME step's own game section, scoped server-side, or a non-game step's `step-volume`/`step-result`. */
export type RoutineStepSectionResponseData =
  | GameSectionResponseData
  | StepVolumeSeriesResponseData
  | StepResultSeriesResponseData;

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
  type ReplayPageSchemaData,
  ReplaySessionIdParam,
  type CompletionSeriesResponseData,
  type VolumeSeriesResponseData,
  type SessionResultSeriesResponseData,
  type TrainedRoutineListResponseData,
  type RoutineHeaderSchemaData,
  type RoutineStepSessionListResponseData,
  StartTrainingRequest,
  type StartTrainingRequestInput,
  type StartTrainingResponseData,
  type ResumeTrainingResponseData,
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
