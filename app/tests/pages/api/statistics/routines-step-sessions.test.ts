import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@services/statistics.service", () => ({
  listRoutineStepSessions: vi.fn(),
}));

import { listRoutineStepSessions } from "@services/statistics.service";
import { GET } from "@routes/statistics/routines/[routineKey]/steps/[stepKey]/sessions";
import { RoutineStepSessionListResponse } from "@routes/types";

const locals = {
  requestId: "req-1",
  auth: { authUserId: "auth-1", playerId: "player-1" },
};

const routineKey = "0198f200-0000-7000-8000-000000000099";
const stepKey = `2-${"c".repeat(32)}`;

function makeUrl(query: Record<string, string>) {
  const url = new URL(
    `http://localhost/api/statistics/routines/${routineKey}/steps/${stepKey}/sessions`,
  );
  for (const [key, value] of Object.entries(query))
    url.searchParams.set(key, value);
  return url;
}

const validRange = {
  from: "2026-01-01T00:00:00+01:00",
  to: "2026-02-01T00:00:00+01:00",
};

describe("GET /api/statistics/routines/:routineKey/steps/:stepKey/sessions", () => {
  beforeEach(() => vi.clearAllMocks());

  it("422s on a missing from (VALIDATION_FAILED)", async () => {
    const response = await GET({
      locals,
      params: { routineKey, stepKey },
      url: makeUrl({ to: validRange.to }),
    } as never);

    expect(response.status).toBe(422);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    const body = await response.json();
    expect(body.error.code).toBe("VALIDATION_FAILED");
    expect(listRoutineStepSessions).not.toHaveBeenCalled();
  });

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
        params: { routineKey, stepKey },
        url: makeUrl({ ...validRange, [key]: value }),
      } as never);

      expect(response.status).toBe(422);
      const body = await response.json();
      expect(body.error.code).toBe("VALIDATION_FAILED");
      expect(listRoutineStepSessions).not.toHaveBeenCalled();
    },
  );

  it("422s when the service reports a malformed routineKey", async () => {
    vi.mocked(listRoutineStepSessions).mockResolvedValue({
      ok: false,
      code: "VALIDATION_FAILED",
      details: { reason: "routineKey is malformed" },
    });

    const response = await GET({
      locals,
      params: { routineKey: "not-a-routine-key", stepKey },
      url: makeUrl(validRange),
    } as never);

    expect(response.status).toBe(422);
    expect(listRoutineStepSessions).toHaveBeenCalledWith(
      "player-1",
      "not-a-routine-key",
      stepKey,
      expect.objectContaining(validRange),
    );
  });

  it("404s when the service reports an unknown routine or step", async () => {
    vi.mocked(listRoutineStepSessions).mockResolvedValue({
      ok: false,
      code: "NOT_FOUND",
    });

    const response = await GET({
      locals,
      params: { routineKey, stepKey },
      url: makeUrl(validRange),
    } as never);

    expect(response.status).toBe(404);
  });

  it("calls the service with the parsed query and returns its response", async () => {
    const listResponse = {
      items: [
        {
          sessionId: "018f1e2a-0000-7000-8000-000000000000",
          rulesetVersionKey: null,
          exerciseRulesetVersionKey: "SWITCHING_V1",
          statusKey: "COMPLETED",
          neverStarted: false,
          startedAt: "2026-01-01T00:00:00.000Z",
          completedAt: "2026-01-01T00:05:00.000Z",
          durationSeconds: 300,
          turnCount: 5,
          dartCount: 15,
          countedScore: 40,
        },
      ],
      nextCursor: null,
      dataVersion: "v1:5:1736467200000",
    };
    vi.mocked(listRoutineStepSessions).mockResolvedValue({
      ok: true,
      data: listResponse,
    });

    const response = await GET({
      locals,
      params: { routineKey, stepKey },
      url: makeUrl(validRange),
    } as never);

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    const body = await response.json();
    expect(body.data).toEqual(listResponse);
    expect(RoutineStepSessionListResponse.safeParse(body.data).success).toBe(
      true,
    );
    expect(listRoutineStepSessions).toHaveBeenCalledWith(
      "player-1",
      routineKey,
      stepKey,
      expect.objectContaining(validRange),
    );
  });
});
