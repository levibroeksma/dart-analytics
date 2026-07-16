export type ApiErrorBody = {
  code: string;
  message: string;
  retryable: boolean;
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
  EventsBatchRequest,
  type EventsBatchRequestInput,
  type BatchWriteResponseData,
  UpdateSessionRequest,
  type UpdateSessionRequestInput,
  type SessionActiveData,
} from '@routes/types';
