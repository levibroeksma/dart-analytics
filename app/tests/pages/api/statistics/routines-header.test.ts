import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@services/statistics.service", () => ({
  getRoutineHeader: vi.fn(),
}));

import { getRoutineHeader } from "@services/statistics.service";
import { GET } from "@routes/statistics/routines/[routineKey]/index";
import { RoutineHeaderSchema } from "@routes/types";
import type { RoutineHeader } from "@services/types";

const locals = {
  requestId: "req-1",
  auth: { authUserId: "auth-1", playerId: "player-1" },
};

const routineKey = "0198f200-0000-7000-8000-000000000099";

function makeUrl(query: Record<string, string> = {}) {
  const url = new URL(`http://localhost/api/statistics/routines/${routineKey}`);
  for (const [key, value] of Object.entries(query))
    url.searchParams.set(key, value);
  return url;
}

describe("GET /api/statistics/routines/:routineKey", () => {
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
        params: { routineKey },
        url: makeUrl({ [key]: value }),
      } as never);

      expect(response.status).toBe(422);
      expect(response.headers.get("Cache-Control")).toBe("private, no-store");
      const body = await response.json();
      expect(body.error.code).toBe("VALIDATION_FAILED");
      expect(getRoutineHeader).not.toHaveBeenCalled();
    },
  );

  it("422s when the service reports a malformed routineKey", async () => {
    vi.mocked(getRoutineHeader).mockResolvedValue({
      ok: false,
      code: "VALIDATION_FAILED",
      details: { reason: "routineKey is malformed" },
    });

    const response = await GET({
      locals,
      params: { routineKey: "not-a-routine-key" },
      url: makeUrl(),
    } as never);

    expect(response.status).toBe(422);
    const body = await response.json();
    expect(body.error.code).toBe("VALIDATION_FAILED");
    expect(getRoutineHeader).toHaveBeenCalledWith(
      "player-1",
      "not-a-routine-key",
    );
  });

  it("404s when the service reports an unknown routine", async () => {
    vi.mocked(getRoutineHeader).mockResolvedValue({
      ok: false,
      code: "NOT_FOUND",
    });

    const response = await GET({
      locals,
      params: { routineKey },
      url: makeUrl(),
    } as never);

    expect(response.status).toBe(404);
    expect(getRoutineHeader).toHaveBeenCalledWith("player-1", routineKey);
  });

  it("calls the service with the caller's playerId and returns its response", async () => {
    const header: RoutineHeader = {
      routineKey,
      routineName: "Evening Practice",
      runCount: 5,
      firstRunAt: "2026-01-01T00:00:00.000Z",
      lastRunAt: "2026-01-10T00:00:00.000Z",
      dataVersion: "v1:5:1736467200000",
      steps: [
        {
          stepKey: `1-${"a".repeat(32)}`,
          sequenceNumber: 1,
          exerciseTypeKey: "GAME",
          exerciseRulesetVersionKey: null,
          gameTypeKey: "501",
          rulesetVersionKey: "501_V1",
          durationSeconds: 300,
          sessionCount: 3,
          firstSeenAt: "2026-01-01T00:00:00.000Z",
          lastSeenAt: "2026-01-10T00:00:00.000Z",
          current: true,
        },
        {
          stepKey: `2-${"c".repeat(32)}`,
          sequenceNumber: 2,
          exerciseTypeKey: "SWITCHING",
          exerciseRulesetVersionKey: "SWITCHING_V1",
          gameTypeKey: null,
          rulesetVersionKey: null,
          durationSeconds: 180,
          sessionCount: 4,
          firstSeenAt: "2026-01-01T00:00:00.000Z",
          lastSeenAt: "2026-01-10T00:00:00.000Z",
          current: true,
        },
      ],
    };
    vi.mocked(getRoutineHeader).mockResolvedValue({ ok: true, data: header });

    const response = await GET({
      locals,
      params: { routineKey },
      url: makeUrl(),
    } as never);

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    const body = await response.json();
    expect(body.data).toEqual(header);
    expect(RoutineHeaderSchema.safeParse(body.data).success).toBe(true);
    expect(getRoutineHeader).toHaveBeenCalledWith("player-1", routineKey);
  });
});
