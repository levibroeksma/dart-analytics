import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@services/statistics.service", () => ({
  listGameSessions: vi.fn(),
}));

import { listGameSessions } from "@services/statistics.service";
import { GET } from "@routes/statistics/games/[gameTypeKey]/sessions";
import { GameSessionListResponse } from "@routes/types";

const locals = {
  requestId: "req-1",
  auth: { authUserId: "auth-1", playerId: "player-1" },
};

function makeUrl(gameTypeKey: string, query: Record<string, string>) {
  const url = new URL(
    `http://localhost/api/statistics/games/${gameTypeKey}/sessions`,
  );
  for (const [key, value] of Object.entries(query))
    url.searchParams.set(key, value);
  return url;
}

describe("GET /api/statistics/games/:gameTypeKey/sessions", () => {
  beforeEach(() => vi.clearAllMocks());

  it("404s on an unknown gameTypeKey", async () => {
    const response = await GET({
      locals,
      params: { gameTypeKey: "NOT_A_GAME" },
      url: makeUrl("NOT_A_GAME", {
        from: "2026-01-01T00:00:00+01:00",
        to: "2026-02-01T00:00:00+01:00",
      }),
    } as never);

    expect(response.status).toBe(404);
    expect(listGameSessions).not.toHaveBeenCalled();
  });

  it("422s on a missing from (VALIDATION_FAILED)", async () => {
    const response = await GET({
      locals,
      params: { gameTypeKey: "501" },
      url: makeUrl("501", { to: "2026-02-01T00:00:00+01:00" }),
    } as never);

    expect(response.status).toBe(422);
    const body = await response.json();
    expect(body.error.code).toBe("VALIDATION_FAILED");
  });

  it("calls the service with the parsed query and the caller's playerId", async () => {
    const listResponse = {
      items: [
        {
          sessionId: "018f1e2a-0000-7000-8000-000000000000",
          rulesetVersionKey: "501_V1",
          statusKey: "COMPLETED",
          contextKey: "STANDALONE",
          neverStarted: false,
          startedAt: "2026-01-01T00:00:00.000Z",
          completedAt: "2026-01-01T00:05:00.000Z",
          durationSeconds: 300,
          turnCount: 10,
          dartCount: 30,
          countedScore: 501,
        },
      ],
      nextCursor: null,
      dataVersion: "v1:1:0",
    };
    vi.mocked(listGameSessions).mockResolvedValue({
      ok: true,
      data: listResponse,
    });

    const response = await GET({
      locals,
      params: { gameTypeKey: "501" },
      url: makeUrl("501", {
        from: "2026-01-01T00:00:00+01:00",
        to: "2026-02-01T00:00:00+01:00",
      }),
    } as never);

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    const body = await response.json();
    expect(body.data).toEqual(listResponse);
    expect(GameSessionListResponse.safeParse(body.data).success).toBe(true);
    expect(listGameSessions).toHaveBeenCalledWith(
      "player-1",
      "501",
      expect.objectContaining({
        from: "2026-01-01T00:00:00+01:00",
        to: "2026-02-01T00:00:00+01:00",
      }),
    );
  });
});
