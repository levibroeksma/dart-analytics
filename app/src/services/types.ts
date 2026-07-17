import type { ErrorCode } from "@server/types";

export * from './rulesets/types';

export type ServiceResult<T> =
  | { ok: true; data: T }
  | { ok: false; code: ErrorCode; details?: Record<string, unknown> };

export type CreateSessionResult = {
  sessionId: string;
  participants: { ref: string; participantTypeKey: string; displayName: string }[];
};

export type AppendBatchResult = { created: { stages: number; turns: number; darts: number } };
