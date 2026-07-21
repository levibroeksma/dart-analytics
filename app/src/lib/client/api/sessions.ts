import { apiRequest } from "./client";
import {
  CreateSessionRequest,
  type CreateSessionRequestInput,
  type CreateSessionResponseData,
  type EventsBatchRequestInput,
  type BatchWriteResponseData,
  type SessionActiveData,
} from "./types";

export type { SessionActiveData };

export class SessionApiError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "SessionApiError";
  }
}

export async function createSession(
  body: CreateSessionRequestInput,
): Promise<CreateSessionResponseData> {
  const payload = CreateSessionRequest.parse(body);
  const result = await apiRequest<CreateSessionResponseData>("/api/sessions", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  if (!result.ok)
    throw new SessionApiError(result.error.code, result.error.message);
  return result.data;
}

export async function appendBatch(
  sessionId: string,
  idempotencyKey: string,
  body: EventsBatchRequestInput,
): Promise<BatchWriteResponseData> {
  const result = await apiRequest<BatchWriteResponseData>(
    `/api/sessions/${sessionId}/events/batch`,
    {
      method: "POST",
      body: JSON.stringify(body),
      headers: { "Idempotency-Key": idempotencyKey },
    },
  );
  if (!result.ok)
    throw new SessionApiError(result.error.code, result.error.message);
  return result.data;
}

export async function completeSession(
  sessionId: string,
  status: string,
): Promise<{ sessionId: string; statusKey: string; completedAt: string }> {
  const result = await apiRequest<{
    sessionId: string;
    statusKey: string;
    completedAt: string;
  }>(`/api/sessions/${sessionId}`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
  if (!result.ok)
    throw new SessionApiError(result.error.code, result.error.message);
  return result.data;
}

export async function fetchActiveSessions(): Promise<SessionActiveData[]> {
  const result = await apiRequest<SessionActiveData[]>("/api/sessions/active");
  if (!result.ok)
    throw new SessionApiError(result.error.code, result.error.message);
  return result.data;
}
