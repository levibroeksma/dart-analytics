import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@client/api/client", () => ({ apiRequest: vi.fn() }));

import { apiRequest } from "@client/api/client";
import { SessionApiError as SessionApiErrorClass } from "@client/api/session-api-error";
import {
  createSession,
  appendBatch,
  completeSession,
  fetchActiveSessions,
  SessionApiError,
} from "@client/api/sessions";

describe("createSession", () => {
  beforeEach(() => vi.resetAllMocks());

  it("returns parsed data on success", async () => {
    vi.mocked(apiRequest).mockResolvedValue({
      ok: true,
      requestId: "r1",
      data: { sessionId: "s1", participants: [] },
    });
    const result = await createSession({
      gameTypeKey: "SCORE_TRAINING",
      rulesetVersionKey: "SCORE_TRAINING_V1",
      captureModeKey: "RECREATIONAL",
      inputModeKey: "QUICK_SCORE",
      config: { source: "inline", config: {} },
    });
    expect(result.sessionId).toBe("s1");
  });

  it("throws SessionApiError on failure", async () => {
    vi.mocked(apiRequest).mockResolvedValue({
      ok: false,
      requestId: "r1",
      error: {
        code: "VALIDATION_FAILED",
        message: "bad request",
        retryable: false,
      },
    });
    await expect(
      createSession({
        gameTypeKey: "x",
        rulesetVersionKey: "x",
        captureModeKey: "x",
        inputModeKey: "x",
        config: { source: "inline", config: {} },
      }),
    ).rejects.toBeInstanceOf(SessionApiError);
  });

  it("carries the envelope's requestId and error details onto the thrown error", async () => {
    vi.mocked(apiRequest).mockResolvedValue({
      ok: false,
      requestId: "req-42",
      error: {
        code: "INTERNAL_ERROR",
        message: "Internal error",
        retryable: false,
        details: { reason: "reference data missing" },
      },
    });
    await expect(
      createSession({
        gameTypeKey: "x",
        rulesetVersionKey: "x",
        captureModeKey: "x",
        inputModeKey: "x",
        config: { source: "inline", config: {} },
      }),
    ).rejects.toMatchObject({
      requestId: "req-42",
      details: { reason: "reference data missing" },
    });
  });
});

describe("appendBatch", () => {
  beforeEach(() => vi.resetAllMocks());

  it("sends the Idempotency-Key header", async () => {
    vi.mocked(apiRequest).mockResolvedValue({
      ok: true,
      requestId: "r1",
      data: { created: { stages: 1, turns: 1, darts: 0 } },
    });
    await appendBatch("s1", "idem-1", { stages: [] });
    expect(apiRequest).toHaveBeenCalledWith(
      "/api/sessions/s1/events/batch",
      expect.objectContaining({ headers: { "Idempotency-Key": "idem-1" } }),
    );
  });
});

describe("completeSession", () => {
  beforeEach(() => vi.resetAllMocks());

  it("PATCHes the session status", async () => {
    vi.mocked(apiRequest).mockResolvedValue({
      ok: true,
      requestId: "r1",
      data: {
        sessionId: "s1",
        statusKey: "COMPLETED",
        completedAt: "2026-07-16T00:00:00.000Z",
      },
    });
    const result = await completeSession("s1", "COMPLETED");
    expect(result.statusKey).toBe("COMPLETED");
  });
});

describe("fetchActiveSessions", () => {
  beforeEach(() => vi.resetAllMocks());

  it("returns the active session list", async () => {
    vi.mocked(apiRequest).mockResolvedValue({
      ok: true,
      requestId: "r1",
      data: [],
    });
    const result = await fetchActiveSessions();
    expect(result).toEqual([]);
  });
});

describe("createSession failure envelope", () => {
  beforeEach(() => vi.resetAllMocks());

  it("throws a SessionApiError carrying code, message, requestId and details", async () => {
    vi.mocked(apiRequest).mockResolvedValue({
      ok: false,
      requestId: "req-pin",
      error: {
        code: "VALIDATION_FAILED",
        message: "pin message",
        retryable: false,
        details: { reason: "pin" },
      },
    });
    const error = await createSession({
      gameTypeKey: "x",
      rulesetVersionKey: "x",
      captureModeKey: "x",
      inputModeKey: "x",
      config: { source: "inline", config: {} },
    }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(SessionApiError);
    expect(error).toMatchObject({
      name: "SessionApiError",
      code: "VALIDATION_FAILED",
      message: "pin message",
      requestId: "req-pin",
      details: { reason: "pin" },
    });
  });

  it.each([
    ["appendBatch", () => appendBatch("s1", "idem-1", { stages: [] })],
    ["completeSession", () => completeSession("s1", "COMPLETED")],
    ["fetchActiveSessions", () => fetchActiveSessions()],
  ])(
    "%s throws a SessionApiError with the envelope's fields",
    async (_name, call) => {
      vi.mocked(apiRequest).mockResolvedValue({
        ok: false,
        requestId: "req-pin",
        error: {
          code: "NOT_FOUND",
          message: "pin message",
          retryable: false,
          details: { reason: "pin" },
        },
      });
      const error = await call().catch((e: unknown) => e);
      expect(error).toBeInstanceOf(SessionApiError);
      expect(error).toMatchObject({
        code: "NOT_FOUND",
        message: "pin message",
        requestId: "req-pin",
        details: { reason: "pin" },
      });
    },
  );
});

describe("SessionApiError identity", () => {
  it("is the same class from sessions and session-api-error", () => {
    expect(SessionApiError).toBe(SessionApiErrorClass);
    expect(new SessionApiErrorClass("X", "m")).toBeInstanceOf(SessionApiError);
  });
});
