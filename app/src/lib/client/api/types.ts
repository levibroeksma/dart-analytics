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
  StartTrainingRequest,
  type StartTrainingRequestInput,
  type StartTrainingResponseData,
  type StartTrainingStepResponseData,
  type CompleteTrainingResponseData,
  type AbandonTrainingResponseData,
  CreateRoutineRequest,
  type CreateRoutineRequestInput,
  UpdateRoutineRequest,
  type UpdateRoutineRequestInput,
  type RoutineExecutionData,
  // fallow-ignore-next-line unused-type -- RoutineListData's items[] element type; kept for a future browser consumer of the routine list
  type RoutineSummaryData,
  type RoutineListData,
  type ExerciseTemplateCatalogEntryData,
} from "@routes/types";
