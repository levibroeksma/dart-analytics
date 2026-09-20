import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@client/api/client", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  apiRequest: vi.fn(),
}));
import { apiRequest } from "@client/api/client";
import {
  listSchedules,
  getSchedule,
  getActiveSchedule,
  createSchedule,
  updateSchedule,
  activateSchedule,
  deactivateSchedule,
  deleteSchedule,
} from "@client/api/schedules";
import { SessionApiError } from "@client/api/sessions";

const SCHEDULE = { scheduleId: "s1", name: "Mine", isActive: false, days: [] };
const DAYS = [{ dayOfWeek: 1, routineTemplateId: "rt-1" }];

beforeEach(() => vi.clearAllMocks());

describe("client schedules api", () => {
  it("listSchedules GETs /api/schedules and unwraps data", async () => {
    vi.mocked(apiRequest).mockResolvedValue({
      ok: true,
      data: { items: [], nextCursor: null },
      requestId: "r",
    });
    expect(await listSchedules()).toEqual({ items: [], nextCursor: null });
    expect(apiRequest).toHaveBeenCalledWith("/api/schedules", {
      method: "GET",
    });
  });

  it("getSchedule encodes the id", async () => {
    vi.mocked(apiRequest).mockResolvedValue({
      ok: true,
      data: SCHEDULE,
      requestId: "r",
    });
    await getSchedule("a b");
    expect(apiRequest).toHaveBeenCalledWith("/api/schedules/a%20b", {
      method: "GET",
    });
  });

  it("getActiveSchedule GETs /api/schedules/active and can resolve null", async () => {
    vi.mocked(apiRequest).mockResolvedValue({
      ok: true,
      data: null,
      requestId: "r",
    });
    expect(await getActiveSchedule()).toBeNull();
    expect(apiRequest).toHaveBeenCalledWith("/api/schedules/active", {
      method: "GET",
    });
  });

  it("createSchedule POSTs the validated body", async () => {
    vi.mocked(apiRequest).mockResolvedValue({
      ok: true,
      data: SCHEDULE,
      requestId: "r",
    });
    await createSchedule({ name: "Mine", days: DAYS });
    expect(apiRequest).toHaveBeenCalledWith(
      "/api/schedules",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("updateSchedule PUTs", async () => {
    vi.mocked(apiRequest).mockResolvedValue({
      ok: true,
      data: SCHEDULE,
      requestId: "r",
    });
    await updateSchedule("s1", { name: "Mine", days: DAYS });
    expect(apiRequest).toHaveBeenCalledWith(
      "/api/schedules/s1",
      expect.objectContaining({ method: "PUT" }),
    );
  });

  it("activateSchedule and deactivateSchedule POST with no body", async () => {
    vi.mocked(apiRequest).mockResolvedValue({
      ok: true,
      data: SCHEDULE,
      requestId: "r",
    });
    await activateSchedule("s1");
    expect(apiRequest).toHaveBeenCalledWith("/api/schedules/s1/activate", {
      method: "POST",
    });
    await deactivateSchedule("s1");
    expect(apiRequest).toHaveBeenCalledWith("/api/schedules/s1/deactivate", {
      method: "POST",
    });
  });

  it("deleteSchedule DELETEs and resolves void", async () => {
    vi.mocked(apiRequest).mockResolvedValue({
      ok: true,
      data: null,
      requestId: "r",
    });
    await expect(deleteSchedule("s1")).resolves.toBeUndefined();
    expect(apiRequest).toHaveBeenCalledWith("/api/schedules/s1", {
      method: "DELETE",
    });
  });

  it("throws SessionApiError carrying code and details on a failure envelope", async () => {
    vi.mocked(apiRequest).mockResolvedValue({
      ok: false,
      requestId: "r",
      error: {
        code: "VALIDATION_FAILED",
        message: "bad",
        retryable: false,
        details: { issues: ["x"] },
      },
    });
    await expect(listSchedules()).rejects.toMatchObject({
      name: "SessionApiError",
      code: "VALIDATION_FAILED",
      details: { issues: ["x"] },
    });
    await expect(listSchedules()).rejects.toBeInstanceOf(SessionApiError);
  });
});
