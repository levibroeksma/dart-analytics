import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@services/statistics.service", () => ({
  listGameVariations: vi.fn(),
}));

import { listGameVariations } from "@services/statistics.service";
import { GET } from "@routes/statistics/games/[gameTypeKey]/variations";
import { GameVariationsResponse } from "@routes/types";

const locals = {
  requestId: "req-1",
  auth: { authUserId: "auth-1", playerId: "player-1" },
};

function call(gameTypeKey: string) {
  return GET({
    locals,
    params: { gameTypeKey },
    url: new URL(
      `http://localhost/api/statistics/games/${gameTypeKey}/variations`,
    ),
  } as never);
}

describe("GET /api/statistics/games/:gameTypeKey/variations", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns the envelope for 501", async () => {
    const data = {
      variations: [
        { startingScore: 501, sessions: 3 },
        { startingScore: 301, sessions: 1 },
      ],
    };
    vi.mocked(listGameVariations).mockResolvedValue({ ok: true, data });

    const response = await call("501");

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    const body = await response.json();
    expect(body.data).toEqual(data);
    expect(GameVariationsResponse.safeParse(body.data).success).toBe(true);
    expect(listGameVariations).toHaveBeenCalledWith("player-1", "501");
  });

  it("404s for TUOD through the service", async () => {
    vi.mocked(listGameVariations).mockResolvedValue({
      ok: false,
      code: "NOT_FOUND",
    });
    const response = await call("TUOD");
    expect(response.status).toBe(404);
  });

  it("404s on an unknown gameTypeKey without calling the service", async () => {
    const response = await call("NOT_A_GAME");
    expect(response.status).toBe(404);
    expect(listGameVariations).not.toHaveBeenCalled();
  });
});
