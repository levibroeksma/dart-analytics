import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@services/schedule.service", () => ({
  listSchedules: vi.fn(),
  getSchedule: vi.fn(),
  getActiveSchedule: vi.fn(),
  createSchedule: vi.fn(),
  replaceSchedule: vi.fn(),
  activateSchedule: vi.fn(),
  deactivateSchedule: vi.fn(),
  deleteSchedule: vi.fn(),
}));

import * as service from "@services/schedule.service";

const locals = { auth: { playerId: "p1" }, requestId: "req-1" };
const body = (value: unknown) =>
  new Request("https://example.test", {
    method: "POST",
    body: JSON.stringify(value),
    headers: { "content-type": "application/json" },
  });
const SCHEDULE = {
  scheduleId: "sch-1",
  name: "Mine",
  isActive: false,
  days: [],
};
const DAYS = [{ dayOfWeek: 1, routineTemplateId: "rt-1" }];

beforeEach(() => vi.clearAllMocks());

describe("/api/schedules", () => {
  it("GET lists", async () => {
    vi.mocked(service.listSchedules).mockResolvedValue({
      ok: true,
      data: { items: [], nextCursor: null },
    });
    const { GET } = await import("@pages/api/schedules/index");
    const response = await GET({ locals } as any);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      ok: true,
      data: { items: [], nextCursor: null },
    });
  });

  it("POST creates and returns 201", async () => {
    vi.mocked(service.createSchedule).mockResolvedValue({
      ok: true,
      data: SCHEDULE,
    });
    const { POST } = await import("@pages/api/schedules/index");
    const response = await POST({
      locals,
      request: body({ name: "Mine", days: DAYS }),
    } as any);
    expect(response.status).toBe(201);
    expect(service.createSchedule).toHaveBeenCalledWith("p1", {
      name: "Mine",
      days: DAYS,
    });
  });

  it("POST returns 422 on a malformed body without calling the service", async () => {
    const { POST } = await import("@pages/api/schedules/index");
    const response = await POST({
      locals,
      request: body({ days: DAYS }),
    } as any);
    expect(response.status).toBe(422);
    expect(service.createSchedule).not.toHaveBeenCalled();
  });

  it("POST returns 422 on a body that is not valid JSON", async () => {
    const { POST } = await import("@pages/api/schedules/index");
    const response = await POST({
      locals,
      request: new Request("https://example.test", {
        method: "POST",
        body: "{not json",
        headers: { "content-type": "application/json" },
      }),
    } as any);
    expect(response.status).toBe(422);
    expect(service.createSchedule).not.toHaveBeenCalled();
  });

  it("maps a VALIDATION_FAILED result (e.g. unknown routineTemplateId) to 422", async () => {
    vi.mocked(service.createSchedule).mockResolvedValue({
      ok: false,
      code: "VALIDATION_FAILED",
      details: { reason: "unknown routineTemplateId", dayOfWeek: 1 },
    });
    const { POST } = await import("@pages/api/schedules/index");
    const response = await POST({
      locals,
      request: body({ name: "Mine", days: DAYS }),
    } as any);
    expect(response.status).toBe(422);
  });
});

describe("GET /api/schedules/active", () => {
  it("returns the active schedule", async () => {
    vi.mocked(service.getActiveSchedule).mockResolvedValue({
      ok: true,
      data: SCHEDULE,
    });
    const { GET } = await import("@pages/api/schedules/active");
    const response = await GET({ locals } as any);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ ok: true, data: SCHEDULE });
    expect(service.getActiveSchedule).toHaveBeenCalledWith("p1");
  });

  it("returns null when no schedule is active", async () => {
    vi.mocked(service.getActiveSchedule).mockResolvedValue({
      ok: true,
      data: null,
    });
    const { GET } = await import("@pages/api/schedules/active");
    const response = await GET({ locals } as any);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ ok: true, data: null });
  });
});

describe("/api/schedules/[scheduleId]", () => {
  it("GET maps NOT_FOUND to 404", async () => {
    vi.mocked(service.getSchedule).mockResolvedValue({
      ok: false,
      code: "NOT_FOUND",
      details: { scheduleId: "x" },
    });
    const { GET } = await import("@pages/api/schedules/[scheduleId]/index");
    const response = await GET({
      locals,
      params: { scheduleId: "x" },
    } as any);
    expect(response.status).toBe(404);
  });

  it("GET returns the schedule", async () => {
    vi.mocked(service.getSchedule).mockResolvedValue({
      ok: true,
      data: SCHEDULE,
    });
    const { GET } = await import("@pages/api/schedules/[scheduleId]/index");
    const response = await GET({
      locals,
      params: { scheduleId: "sch-1" },
    } as any);
    expect(response.status).toBe(200);
    expect(service.getSchedule).toHaveBeenCalledWith("p1", "sch-1");
  });

  it("PUT replaces", async () => {
    vi.mocked(service.replaceSchedule).mockResolvedValue({
      ok: true,
      data: SCHEDULE,
    });
    const { PUT } = await import("@pages/api/schedules/[scheduleId]/index");
    const response = await PUT({
      locals,
      params: { scheduleId: "sch-1" },
      request: body({ name: "Mine", days: DAYS }),
    } as any);
    expect(response.status).toBe(200);
    expect(service.replaceSchedule).toHaveBeenCalledWith("p1", "sch-1", {
      name: "Mine",
      days: DAYS,
    });
  });

  it("PUT returns 422 on a malformed body without calling the service", async () => {
    const { PUT } = await import("@pages/api/schedules/[scheduleId]/index");
    const response = await PUT({
      locals,
      params: { scheduleId: "sch-1" },
      request: body({ days: DAYS }),
    } as any);
    expect(response.status).toBe(422);
    expect(service.replaceSchedule).not.toHaveBeenCalled();
  });

  it("DELETE returns 204 with an empty body", async () => {
    vi.mocked(service.deleteSchedule).mockResolvedValue({
      ok: true,
      data: null,
    });
    const { DELETE } = await import("@pages/api/schedules/[scheduleId]/index");
    const response = await DELETE({
      locals,
      params: { scheduleId: "sch-1" },
    } as any);
    expect(response.status).toBe(204);
    expect(await response.text()).toBe("");
  });

  it("DELETE maps NOT_FOUND to 404", async () => {
    vi.mocked(service.deleteSchedule).mockResolvedValue({
      ok: false,
      code: "NOT_FOUND",
      details: { scheduleId: "sch-1" },
    });
    const { DELETE } = await import("@pages/api/schedules/[scheduleId]/index");
    const response = await DELETE({
      locals,
      params: { scheduleId: "sch-1" },
    } as any);
    expect(response.status).toBe(404);
  });
});

describe("POST /api/schedules/[scheduleId]/activate", () => {
  it("delegates to activateSchedule", async () => {
    vi.mocked(service.activateSchedule).mockResolvedValue({
      ok: true,
      data: { ...SCHEDULE, isActive: true },
    });
    const { POST } = await import("@pages/api/schedules/[scheduleId]/activate");
    const response = await POST({
      locals,
      params: { scheduleId: "sch-1" },
    } as any);
    expect(response.status).toBe(200);
    expect(service.activateSchedule).toHaveBeenCalledWith("p1", "sch-1");
    expect((await response.json()).data.isActive).toBe(true);
  });

  it("maps NOT_FOUND to 404", async () => {
    vi.mocked(service.activateSchedule).mockResolvedValue({
      ok: false,
      code: "NOT_FOUND",
      details: { scheduleId: "sch-1" },
    });
    const { POST } = await import("@pages/api/schedules/[scheduleId]/activate");
    const response = await POST({
      locals,
      params: { scheduleId: "sch-1" },
    } as any);
    expect(response.status).toBe(404);
  });
});

describe("POST /api/schedules/[scheduleId]/deactivate", () => {
  it("delegates to deactivateSchedule", async () => {
    vi.mocked(service.deactivateSchedule).mockResolvedValue({
      ok: true,
      data: { ...SCHEDULE, isActive: false },
    });
    const { POST } =
      await import("@pages/api/schedules/[scheduleId]/deactivate");
    const response = await POST({
      locals,
      params: { scheduleId: "sch-1" },
    } as any);
    expect(response.status).toBe(200);
    expect(service.deactivateSchedule).toHaveBeenCalledWith("p1", "sch-1");
    expect((await response.json()).data.isActive).toBe(false);
  });

  it("maps NOT_FOUND to 404", async () => {
    vi.mocked(service.deactivateSchedule).mockResolvedValue({
      ok: false,
      code: "NOT_FOUND",
      details: { scheduleId: "sch-1" },
    });
    const { POST } =
      await import("@pages/api/schedules/[scheduleId]/deactivate");
    const response = await POST({
      locals,
      params: { scheduleId: "sch-1" },
    } as any);
    expect(response.status).toBe(404);
  });
});
