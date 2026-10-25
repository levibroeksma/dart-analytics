import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@services/statistics.service", () => ({ getHomeStats: vi.fn() }));

import { getHomeStats } from "@services/statistics.service";
import { GET } from "@routes/statistics/home";

const locals = {
  requestId: "req-1",
  auth: { authUserId: "auth-1", playerId: "player-1" },
};

function makeUrl(query: Record<string, string>) {
  const url = new URL("http://localhost/api/statistics/home");
  for (const [key, value] of Object.entries(query))
    url.searchParams.set(key, value);
  return url;
}

describe("GET /api/statistics/home", () => {
  beforeEach(() => vi.clearAllMocks());

  it("422s without a tz", async () => {
    const response = await GET({
      locals,
      params: {},
      url: makeUrl({}),
    } as never);
    expect(response.status).toBe(422);
    expect(getHomeStats).not.toHaveBeenCalled();
  });

  it("422s on an unknown tz", async () => {
    const response = await GET({
      locals,
      params: {},
      url: makeUrl({ tz: "Mars/Olympus" }),
    } as never);
    expect(response.status).toBe(422);
    expect(getHomeStats).not.toHaveBeenCalled();
  });

  it("422s on an unexpected param", async () => {
    const response = await GET({
      locals,
      params: {},
      url: makeUrl({ tz: "Europe/Amsterdam", from: "2026-01-01T00:00:00Z" }),
    } as never);
    expect(response.status).toBe(422);
  });

  it("returns the caller's home stats", async () => {
    const stats = {
      firstNine: { current: 90, previous: 60, delta: 30 },
      daily: [],
      landing: { cellMm: 4, cells: [] },
    };
    vi.mocked(getHomeStats).mockResolvedValue({ ok: true, data: stats });

    const response = await GET({
      locals,
      params: {},
      url: makeUrl({ tz: "Europe/Amsterdam" }),
    } as never);

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect((await response.json()).data).toEqual(stats);
    expect(getHomeStats).toHaveBeenCalledWith("player-1", {
      tz: "Europe/Amsterdam",
      now: expect.any(Date),
    });
  });
});
