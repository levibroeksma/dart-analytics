import { describe, it, expect, vi } from "vitest";

vi.mock("@services/routine.service", () => ({
  listExerciseTemplates: vi.fn(),
}));
import * as service from "@services/routine.service";

describe("GET /api/exercise-templates", () => {
  it("returns the catalog array", async () => {
    vi.mocked(service.listExerciseTemplates).mockResolvedValue({
      ok: true,
      data: [],
    });
    const { GET } = await import("@pages/api/exercise-templates/index");
    const response = await GET({
      locals: { auth: { playerId: "p1" }, requestId: "r" },
    } as any);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ ok: true, data: [] });
  });
});
