import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@client/api/client", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  apiRequest: vi.fn(),
}));
import { apiRequest } from "@client/api/client";
import {
  listRoutines,
  getRoutine,
  createRoutine,
  updateRoutine,
  deleteRoutine,
  listExerciseTemplates,
} from "@client/api/routines";
import { SessionApiError } from "@client/api/sessions";

beforeEach(() => vi.clearAllMocks());

describe("client routines api", () => {
  it("listRoutines GETs /api/routines and unwraps data", async () => {
    vi.mocked(apiRequest).mockResolvedValue({
      ok: true,
      data: { items: [], nextCursor: null },
      requestId: "r",
    });
    expect(await listRoutines()).toEqual({ items: [], nextCursor: null });
    expect(apiRequest).toHaveBeenCalledWith("/api/routines", { method: "GET" });
  });

  it("getRoutine encodes the id", async () => {
    vi.mocked(apiRequest).mockResolvedValue({
      ok: true,
      data: {},
      requestId: "r",
    });
    await getRoutine("a b");
    expect(apiRequest).toHaveBeenCalledWith("/api/routines/a%20b", {
      method: "GET",
    });
  });

  it("createRoutine POSTs the validated body", async () => {
    vi.mocked(apiRequest).mockResolvedValue({
      ok: true,
      data: {},
      requestId: "r",
    });
    await createRoutine({
      name: "A",
      description: null,
      steps: [
        {
          exerciseTemplateId: "e",
          durationTypeKey: "MINUTES",
          durationValue: 30,
        },
      ],
    });
    expect(apiRequest).toHaveBeenCalledWith(
      "/api/routines",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("updateRoutine PUTs; deleteRoutine DELETEs and resolves void", async () => {
    vi.mocked(apiRequest).mockResolvedValue({
      ok: true,
      data: null,
      requestId: "r",
    });
    await updateRoutine("rt", {
      name: "A",
      description: null,
      steps: [
        {
          exerciseTemplateId: "e",
          durationTypeKey: "MINUTES",
          durationValue: 30,
        },
      ],
    });
    expect(apiRequest).toHaveBeenCalledWith(
      "/api/routines/rt",
      expect.objectContaining({ method: "PUT" }),
    );
    await expect(deleteRoutine("rt")).resolves.toBeUndefined();
    expect(apiRequest).toHaveBeenCalledWith("/api/routines/rt", {
      method: "DELETE",
    });
  });

  it("listExerciseTemplates GETs the catalog", async () => {
    vi.mocked(apiRequest).mockResolvedValue({
      ok: true,
      data: [],
      requestId: "r",
    });
    expect(await listExerciseTemplates()).toEqual([]);
    expect(apiRequest).toHaveBeenCalledWith("/api/exercise-templates", {
      method: "GET",
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
    await expect(listRoutines()).rejects.toMatchObject({
      name: "SessionApiError",
      code: "VALIDATION_FAILED",
      details: { issues: ["x"] },
    });
    await expect(listRoutines()).rejects.toBeInstanceOf(SessionApiError);
  });
});
