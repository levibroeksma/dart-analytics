import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@services/statistics.service", () => ({
  listTrainedRoutines: vi.fn(),
}));

import { listTrainedRoutines } from "@services/statistics.service";
import { GET } from "@routes/statistics/routines/index";
import { TrainedRoutineListResponse } from "@routes/types";

const locals = {
  requestId: "req-1",
  auth: { authUserId: "auth-1", playerId: "player-1" },
};

function makeUrl(query: Record<string, string> = {}) {
  const url = new URL("http://localhost/api/statistics/routines");
  for (const [key, value] of Object.entries(query))
    url.searchParams.set(key, value);
  return url;
}

describe("GET /api/statistics/routines", () => {
  beforeEach(() => vi.clearAllMocks());

  it.each([
    ["context", "routine"],
    ["context", "all"],
    ["inputMode", "VISUAL_BOARD"],
    ["foo", "1"],
  ])(
    "422s on an unexpected %s param (VALIDATION_FAILED)",
    async (key, value) => {
      const response = await GET({
        locals,
        url: makeUrl({ [key]: value }),
      } as never);

      expect(response.status).toBe(422);
      expect(response.headers.get("Cache-Control")).toBe("private, no-store");
      const body = await response.json();
      expect(body.error.code).toBe("VALIDATION_FAILED");
      expect(listTrainedRoutines).not.toHaveBeenCalled();
    },
  );

  it("calls the service with the caller's playerId and returns its response", async () => {
    const listResponse = {
      items: [
        {
          routineKey: "0198f200-0000-7000-8000-000000000099",
          routineTemplateId: "0198f200-0000-7000-8000-000000000099",
          routineName: "Evening Practice",
          runCount: 5,
          completedRunCount: 4,
          lastRunAt: "2026-01-10T00:00:00.000Z",
        },
        {
          routineKey: `name-${"b".repeat(32)}`,
          routineTemplateId: null,
          routineName: "Legacy Routine",
          runCount: 2,
          completedRunCount: 2,
          lastRunAt: "2026-01-05T00:00:00.000Z",
        },
      ],
    };
    vi.mocked(listTrainedRoutines).mockResolvedValue({
      ok: true,
      data: listResponse,
    });

    const response = await GET({ locals, url: makeUrl() } as never);

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    const body = await response.json();
    expect(body.data).toEqual(listResponse);
    expect(TrainedRoutineListResponse.safeParse(body.data).success).toBe(true);
    expect(listTrainedRoutines).toHaveBeenCalledWith("player-1");
  });
});
