import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@services/routine.service", () => ({
  listRoutines: vi.fn(),
  getRoutine: vi.fn(),
  createRoutine: vi.fn(),
  replaceRoutine: vi.fn(),
  deleteRoutine: vi.fn(),
}));

import * as service from "@services/routine.service";

const locals = { auth: { playerId: "p1" }, requestId: "req-1" };
const body = (value: unknown) =>
  new Request("https://example.test", {
    method: "POST",
    body: JSON.stringify(value),
    headers: { "content-type": "application/json" },
  });
const ROUTINE = {
  routineId: "rt-1",
  routineName: "Mine",
  description: null,
  isSystemTemplate: false,
  steps: [],
};
const STEPS = [
  { exerciseTemplateId: "et-1", durationTypeKey: "MINUTES", durationValue: 30 },
];

beforeEach(() => vi.clearAllMocks());

describe("/api/routines", () => {
  it("GET lists", async () => {
    vi.mocked(service.listRoutines).mockResolvedValue({
      ok: true,
      data: { items: [], nextCursor: null },
    });
    const { GET } = await import("@pages/api/routines/index");
    const response = await GET({ locals } as any);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      ok: true,
      data: { items: [], nextCursor: null },
    });
  });

  it("POST creates and returns 201", async () => {
    vi.mocked(service.createRoutine).mockResolvedValue({
      ok: true,
      data: ROUTINE,
    });
    const { POST } = await import("@pages/api/routines/index");
    const response = await POST({
      locals,
      request: body({ name: "Mine", steps: STEPS }),
    } as any);
    expect(response.status).toBe(201);
    expect(service.createRoutine).toHaveBeenCalledWith("p1", {
      name: "Mine",
      description: null,
      steps: STEPS,
    });
  });

  it("POST returns 422 on a malformed body without calling the service", async () => {
    const { POST } = await import("@pages/api/routines/index");
    const response = await POST({
      locals,
      request: body({ name: "Mine" }),
    } as any);
    expect(response.status).toBe(422);
    expect(service.createRoutine).not.toHaveBeenCalled();
  });
});

describe("/api/routines/[routineId]", () => {
  it("GET maps NOT_FOUND to 404", async () => {
    vi.mocked(service.getRoutine).mockResolvedValue({
      ok: false,
      code: "NOT_FOUND",
      details: { routineId: "x" },
    });
    const { GET } = await import("@pages/api/routines/[routineId]");
    const response = await GET({ locals, params: { routineId: "x" } } as any);
    expect(response.status).toBe(404);
  });

  it("PUT replaces", async () => {
    vi.mocked(service.replaceRoutine).mockResolvedValue({
      ok: true,
      data: ROUTINE,
    });
    const { PUT } = await import("@pages/api/routines/[routineId]");
    const response = await PUT({
      locals,
      params: { routineId: "rt-1" },
      request: body({ name: "Mine", steps: STEPS }),
    } as any);
    expect(response.status).toBe(200);
    expect(service.replaceRoutine).toHaveBeenCalledWith("p1", "rt-1", {
      name: "Mine",
      description: null,
      steps: STEPS,
    });
  });

  it("DELETE returns 204 with an empty body", async () => {
    vi.mocked(service.deleteRoutine).mockResolvedValue({
      ok: true,
      data: null,
    });
    const { DELETE } = await import("@pages/api/routines/[routineId]");
    const response = await DELETE({
      locals,
      params: { routineId: "rt-1" },
    } as any);
    expect(response.status).toBe(204);
    expect(await response.text()).toBe("");
  });

  it("DELETE maps the read-only system routine to 422", async () => {
    vi.mocked(service.deleteRoutine).mockResolvedValue({
      ok: false,
      code: "VALIDATION_FAILED",
      details: { reason: "system routine is read-only" },
    });
    const { DELETE } = await import("@pages/api/routines/[routineId]");
    const response = await DELETE({
      locals,
      params: { routineId: "rt-sys" },
    } as any);
    expect(response.status).toBe(422);
  });
});
