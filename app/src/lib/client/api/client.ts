import { getAccessToken } from "@client/auth/client";
import type { ApiFailure, ApiResult } from "./types";

const UNAUTHORIZED: ApiFailure = {
  ok: false,
  requestId: "",
  error: {
    code: "UNAUTHORIZED",
    message: "Authentication required",
    retryable: false,
  },
};

const MAX_GET_RETRIES = 2;
const RETRY_BASE_MS = 200;

function serviceUnavailable(status?: number): ApiFailure {
  return {
    ok: false,
    requestId: "",
    error: {
      code: "SERVICE_UNAVAILABLE",
      message: "Service temporarily unavailable",
      retryable: true,
      ...(status === undefined ? {} : { details: { status } }),
    },
  };
}

function isEnvelope<T>(value: unknown): value is ApiResult<T> {
  return typeof value === "object" && value !== null && "ok" in value;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Performs a single fetch attempt and normalizes any transport or parse
 * failure into a retryable SERVICE_UNAVAILABLE envelope instead of throwing.
 */
async function attempt<T>(
  path: string,
  init: RequestInit,
  headers: Headers,
): Promise<ApiResult<T>> {
  let response: Response;
  try {
    response = await fetch(path, { ...init, headers });
  } catch {
    return serviceUnavailable();
  }
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    return serviceUnavailable(response.status);
  }
  if (!isEnvelope<T>(body)) return serviceUnavailable(response.status);
  return body;
}

/**
 * Authenticated JSON request against the Worker API. Always resolves to an
 * ApiResult — transport/parse failures become a retryable SERVICE_UNAVAILABLE
 * failure. GET requests (idempotent) retry with backoff on retryable failures;
 * writes are never auto-retried (they own idempotency keys at the call site).
 */
export async function apiRequest<T>(
  path: string,
  init: RequestInit = {},
): Promise<ApiResult<T>> {
  const token = await getAccessToken();
  if (!token) return UNAUTHORIZED;

  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${token}`);
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const method = (init.method ?? "GET").toUpperCase();
  const maxAttempts = method === "GET" ? MAX_GET_RETRIES + 1 : 1;

  let result = await attempt<T>(path, init, headers);
  for (let i = 1; i < maxAttempts; i++) {
    if (result.ok || !result.error.retryable) break;
    await sleep(RETRY_BASE_MS * i);
    result = await attempt<T>(path, init, headers);
  }
  return result;
}
