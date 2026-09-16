import { describe, it, expect, vi } from "vitest";

vi.mock("@services/training-session.service", () => ({
  startTraining: vi.fn(),
  startTrainingStep: vi.fn(),
  completeTraining: vi.fn(),
  abandonTraining: vi.fn(),
}));

import * as service from "@services/training-session.service";

function request(body: unknown) {
  return new Request("https://example.test", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

describe("POST /api/training-sessions", () => {
  it("delegates to startTraining and returns 201", async () => {
    vi.mocked(service.startTraining).mockResolvedValue({
      ok: true,
      data: {
        activityId: "act-1",
        routineName: "Balanced Training",
        steps: [],
      },
    });
    const { POST } = await import("@pages/api/training-sessions/index");
    const response = await POST({
      locals: { auth: { playerId: "p1" }, requestId: "req-1" },
      request: request({ routineTemplateName: "Balanced Training" }),
    } as any);
    expect(response.status).toBe(201);
    expect(service.startTraining).toHaveBeenCalledWith(
      "p1",
      "Balanced Training",
    );
  });

  it("returns a VALIDATION_FAILED envelope when the body is malformed", async () => {
    const { POST } = await import("@pages/api/training-sessions/index");
    const response = await POST({
      locals: { auth: { playerId: "p1" }, requestId: "req-1" },
      request: request({}),
    } as any);
    expect(response.status).toBe(422);
  });
});

describe("POST /api/training-sessions/[activityId]/steps/[sequenceNumber]", () => {
  it("delegates to startTrainingStep", async () => {
    vi.mocked(service.startTrainingStep).mockResolvedValue({
      ok: true,
      data: {
        sessionId: "s1",
        exerciseTypeKey: "WARM_UP",
        configuration: {},
        participant: { ref: "pt1", displayName: "Levi" },
      },
    });
    const { POST } =
      await import("@pages/api/training-sessions/[activityId]/steps/[sequenceNumber]");
    const response = await POST({
      locals: { auth: { playerId: "p1" }, requestId: "req-1" },
      params: { activityId: "act-1", sequenceNumber: "1" },
      request: request({}),
    } as any);
    expect(response.status).toBe(201);
    expect(service.startTrainingStep).toHaveBeenCalledWith("p1", "act-1", 1);
  });

  it("returns 403 when the activity belongs to another player", async () => {
    vi.mocked(service.startTrainingStep).mockResolvedValue({
      ok: false,
      code: "SESSION_OWNERSHIP_MISMATCH",
      details: { activityId: "act-1" },
    });
    const { POST } =
      await import("@pages/api/training-sessions/[activityId]/steps/[sequenceNumber]");
    const response = await POST({
      locals: { auth: { playerId: "intruder" }, requestId: "req-1" },
      params: { activityId: "act-1", sequenceNumber: "1" },
      request: request({}),
    } as any);
    expect(response.status).toBe(403);
  });
});

describe("PATCH /api/training-sessions/[activityId]/complete", () => {
  it("delegates to completeTraining", async () => {
    vi.mocked(service.completeTraining).mockResolvedValue({
      ok: true,
      data: { activityId: "act-1", completedAt: "2026-09-12T12:00:00.000Z" },
    });
    const { PATCH } =
      await import("@pages/api/training-sessions/[activityId]/complete");
    const response = await PATCH({
      locals: { auth: { playerId: "p1" }, requestId: "req-1" },
      params: { activityId: "act-1" },
    } as any);
    expect(response.status).toBe(200);
    expect(service.completeTraining).toHaveBeenCalledWith("p1", "act-1");
  });
});

describe("PATCH /api/training-sessions/[activityId]/abandon", () => {
  it("delegates to abandonTraining", async () => {
    vi.mocked(service.abandonTraining).mockResolvedValue({
      ok: true,
      data: { activityId: "act-1", completedAt: "2026-09-13T12:00:00.000Z" },
    });
    const { PATCH } =
      await import("@pages/api/training-sessions/[activityId]/abandon");
    const response = await PATCH({
      locals: { auth: { playerId: "p1" }, requestId: "req-1" },
      params: { activityId: "act-1" },
    } as any);
    expect(response.status).toBe(200);
    expect(service.abandonTraining).toHaveBeenCalledWith("p1", "act-1");
  });

  it("returns a NOT_FOUND envelope when the activity does not belong to the player", async () => {
    vi.mocked(service.abandonTraining).mockResolvedValue({
      ok: false,
      code: "NOT_FOUND",
      details: { activityId: "act-1" },
    });
    const { PATCH } =
      await import("@pages/api/training-sessions/[activityId]/abandon");
    const response = await PATCH({
      locals: { auth: { playerId: "p1" }, requestId: "req-1" },
      params: { activityId: "act-1" },
    } as any);
    expect(response.status).toBe(404);
  });

  it("returns a 409 envelope when the activity already reached a terminal status", async () => {
    vi.mocked(service.abandonTraining).mockResolvedValue({
      ok: false,
      code: "SESSION_ALREADY_COMPLETED",
      details: { activityId: "act-1" },
    });
    const { PATCH } =
      await import("@pages/api/training-sessions/[activityId]/abandon");
    const response = await PATCH({
      locals: { auth: { playerId: "p1" }, requestId: "req-1" },
      params: { activityId: "act-1" },
    } as any);
    expect(response.status).toBe(409);
  });
});
