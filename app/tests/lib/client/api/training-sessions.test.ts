import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@client/api/client", () => ({ apiRequest: vi.fn() }));

import { apiRequest } from "@client/api/client";
import {
  startTraining,
  startTrainingStep,
  completeTraining,
} from "@client/api/training-sessions";
import { SessionApiError } from "@client/api/sessions";

describe("startTraining", () => {
  beforeEach(() => vi.resetAllMocks());

  it("returns parsed data on success", async () => {
    vi.mocked(apiRequest).mockResolvedValue({
      ok: true,
      requestId: "r1",
      data: {
        activityId: "act-1",
        routineName: "Balanced Training",
        steps: [],
      },
    });
    const result = await startTraining({
      routineTemplateName: "Balanced Training",
    });
    expect(result.activityId).toBe("act-1");
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
      startTraining({ routineTemplateName: "Unknown Routine" }),
    ).rejects.toBeInstanceOf(SessionApiError);
  });
});

describe("startTrainingStep", () => {
  beforeEach(() => vi.resetAllMocks());

  it("posts to the step endpoint and returns parsed data", async () => {
    vi.mocked(apiRequest).mockResolvedValue({
      ok: true,
      requestId: "r1",
      data: {
        sessionId: "s1",
        exerciseTypeKey: "WARM_UP",
        configuration: {},
        participant: { ref: "pt1", displayName: "Levi" },
      },
    });
    const result = await startTrainingStep("act-1", 1);
    expect(result.sessionId).toBe("s1");
    expect(apiRequest).toHaveBeenCalledWith(
      "/api/training-sessions/act-1/steps/1",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("throws SessionApiError on failure", async () => {
    vi.mocked(apiRequest).mockResolvedValue({
      ok: false,
      requestId: "r1",
      error: { code: "NOT_FOUND", message: "not found", retryable: false },
    });
    await expect(startTrainingStep("act-1", 99)).rejects.toBeInstanceOf(
      SessionApiError,
    );
  });
});

describe("completeTraining", () => {
  beforeEach(() => vi.resetAllMocks());

  it("patches the complete endpoint and returns parsed data", async () => {
    vi.mocked(apiRequest).mockResolvedValue({
      ok: true,
      requestId: "r1",
      data: { activityId: "act-1", completedAt: "2026-09-12T12:00:00.000Z" },
    });
    const result = await completeTraining("act-1");
    expect(result.completedAt).toBe("2026-09-12T12:00:00.000Z");
    expect(apiRequest).toHaveBeenCalledWith(
      "/api/training-sessions/act-1/complete",
      expect.objectContaining({ method: "PATCH" }),
    );
  });

  it("throws SessionApiError on failure", async () => {
    vi.mocked(apiRequest).mockResolvedValue({
      ok: false,
      requestId: "r1",
      error: { code: "NOT_FOUND", message: "not found", retryable: false },
    });
    await expect(completeTraining("act-1")).rejects.toBeInstanceOf(
      SessionApiError,
    );
  });
});
