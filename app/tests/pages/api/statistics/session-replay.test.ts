import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@services/statistics.service", () => ({
  getSessionReplay: vi.fn(),
}));

import { getSessionReplay } from "@services/statistics.service";
import { GET } from "@routes/statistics/sessions/[sessionId]/replay";
import { ReplayPageSchema } from "@routes/types";

const SESSION_ID = "018f1e2a-0000-7000-8000-000000000000";

const locals = {
  requestId: "req-1",
  auth: { authUserId: "auth-1", playerId: "player-1" },
};

function makeUrl(sessionId: string, query: Record<string, string>) {
  const url = new URL(
    `http://localhost/api/statistics/sessions/${sessionId}/replay`,
  );
  for (const [key, value] of Object.entries(query))
    url.searchParams.set(key, value);
  return url;
}

const pageResponse = {
  header: {
    sessionId: SESSION_ID,
    gameTypeKey: "501",
    rulesetVersionKey: "501_V1",
    inputModeKey: "VISUAL_BOARD",
    statusKey: "COMPLETED",
    contextKey: "STANDALONE",
    activityId: "018f1e2a-0000-7000-8000-000000000001",
    routineStepSequenceNumber: null,
    configuration: null,
    startedAt: "2026-01-01T00:00:00.000Z",
    completedAt: "2026-01-01T00:05:00.000Z",
    durationSeconds: 300,
    turnCount: 1,
    dartCount: 1,
    exerciseTypeKey: "GAME",
    exerciseRulesetVersionKey: null,
    routineKey: null,
    stepKey: null,
    participants: [
      {
        participantId: "018f1e2a-0000-7000-8000-000000000002",
        displayName: "Levi",
        participantTypeKey: "PLAYER",
      },
    ],
    stages: [
      {
        stageId: "018f1e2a-0000-7000-8000-000000000003",
        parentStageId: null,
        stageTypeKey: "LEG",
        sequence: 1,
      },
    ],
  },
  turns: [
    {
      stageId: "018f1e2a-0000-7000-8000-000000000003",
      turnSequence: 1,
      participantId: "018f1e2a-0000-7000-8000-000000000002",
      turnTotalScore: 60,
      darts: [
        {
          dartNumber: 1,
          intendedTargetNumber: null,
          intendedZoneKey: null,
          hitTargetNumber: 20,
          hitZoneKey: "TREBLE",
          score: 60,
          locationX: 12.3,
          locationY: -4.5,
        },
      ],
    },
  ],
  nextCursor: null,
};

describe("GET /api/statistics/sessions/:sessionId/replay", () => {
  beforeEach(() => vi.clearAllMocks());

  it("422s on a non-UUID sessionId", async () => {
    const response = await GET({
      locals,
      params: { sessionId: "not-a-uuid" },
      url: makeUrl("not-a-uuid", {}),
    } as never);

    expect(response.status).toBe(422);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    const body = await response.json();
    expect(body.error.code).toBe("VALIDATION_FAILED");
    expect(getSessionReplay).not.toHaveBeenCalled();
  });

  it("422s on an unrecognized query param (foo)", async () => {
    const response = await GET({
      locals,
      params: { sessionId: SESSION_ID },
      url: makeUrl(SESSION_ID, { foo: "1" }),
    } as never);

    expect(response.status).toBe(422);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    const body = await response.json();
    expect(body.error.code).toBe("VALIDATION_FAILED");
    expect(getSessionReplay).not.toHaveBeenCalled();
  });

  it("422s on from (a statistics-range param this route does not accept)", async () => {
    const response = await GET({
      locals,
      params: { sessionId: SESSION_ID },
      url: makeUrl(SESSION_ID, { from: "2026-01-01T00:00:00+01:00" }),
    } as never);

    expect(response.status).toBe(422);
    expect(getSessionReplay).not.toHaveBeenCalled();
  });

  it("422s on bucket=month", async () => {
    const response = await GET({
      locals,
      params: { sessionId: SESSION_ID },
      url: makeUrl(SESSION_ID, { bucket: "month" }),
    } as never);

    expect(response.status).toBe(422);
    expect(getSessionReplay).not.toHaveBeenCalled();
  });

  it("422s on limit=0", async () => {
    const response = await GET({
      locals,
      params: { sessionId: SESSION_ID },
      url: makeUrl(SESSION_ID, { limit: "0" }),
    } as never);

    expect(response.status).toBe(422);
    expect(getSessionReplay).not.toHaveBeenCalled();
  });

  it("422s on limit=121", async () => {
    const response = await GET({
      locals,
      params: { sessionId: SESSION_ID },
      url: makeUrl(SESSION_ID, { limit: "121" }),
    } as never);

    expect(response.status).toBe(422);
    expect(getSessionReplay).not.toHaveBeenCalled();
  });

  it("404s with Cache-Control: private, no-store when the service returns NOT_FOUND", async () => {
    vi.mocked(getSessionReplay).mockResolvedValue({
      ok: false,
      code: "NOT_FOUND",
    });

    const response = await GET({
      locals,
      params: { sessionId: SESSION_ID },
      url: makeUrl(SESSION_ID, {}),
    } as never);

    expect(response.status).toBe(404);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
  });

  it("calls the service with the caller's playerId, the id and the default parsed query, returning a private, no-store, schema-valid page", async () => {
    vi.mocked(getSessionReplay).mockResolvedValue({
      ok: true,
      data: pageResponse as never,
    });

    const response = await GET({
      locals,
      params: { sessionId: SESSION_ID },
      url: makeUrl(SESSION_ID, {}),
    } as never);

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    const body = await response.json();
    expect(body.data).toEqual(pageResponse);
    expect(ReplayPageSchema.safeParse(body.data).success).toBe(true);
    expect(getSessionReplay).toHaveBeenCalledWith("player-1", SESSION_ID, {
      cursor: null,
      limit: 30,
    });
  });

  it("passes a caller-supplied cursor and limit through to the service", async () => {
    vi.mocked(getSessionReplay).mockResolvedValue({
      ok: true,
      data: { ...pageResponse, header: null } as never,
    });

    const response = await GET({
      locals,
      params: { sessionId: SESSION_ID },
      url: makeUrl(SESSION_ID, { cursor: "v1:abc:2", limit: "50" }),
    } as never);

    expect(response.status).toBe(200);
    expect(getSessionReplay).toHaveBeenCalledWith("player-1", SESSION_ID, {
      cursor: "v1:abc:2",
      limit: 50,
    });
  });
});
