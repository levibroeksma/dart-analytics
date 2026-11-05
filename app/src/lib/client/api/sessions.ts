import { apiRequest } from "./client";
import { unwrapOrThrow } from "./unwrap";
import {
  CreateSessionRequest,
  type CreateSessionRequestInput,
  type CreateSessionResponseData,
  type EventsBatchRequestInput,
  type BatchWriteResponseData,
  type SessionActiveData,
} from "./types";

export type { SessionActiveData };

export { SessionApiError } from "./session-api-error";

export async function createSession(
  body: CreateSessionRequestInput,
): Promise<CreateSessionResponseData> {
  const payload = CreateSessionRequest.parse(body);
  const result = await apiRequest<CreateSessionResponseData>("/api/sessions", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return unwrapOrThrow(result);
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
  return unwrapOrThrow(result);
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
  return unwrapOrThrow(result);
}

export async function fetchActiveSessions(): Promise<SessionActiveData[]> {
  const result = await apiRequest<SessionActiveData[]>("/api/sessions/active");
  return unwrapOrThrow(result);
}
