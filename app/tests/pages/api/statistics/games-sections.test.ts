import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@services/statistics.service", () => ({
  getGameSection: vi.fn(),
}));

import { getGameSection } from "@services/statistics.service";
import { GET } from "@routes/statistics/games/[gameTypeKey]/sections/[sectionId]";
import { CompletionSeriesResponse } from "@routes/types";
import type { CompletionSeriesResponseData } from "@routes/types";

const locals = {
  requestId: "req-1",
  auth: { authUserId: "auth-1", playerId: "player-1" },
};

function makeUrl(
  gameTypeKey: string,
  sectionId: string,
  query: Record<string, string>,
) {
  const url = new URL(
    `http://localhost/api/statistics/games/${gameTypeKey}/sections/${sectionId}`,
  );
  for (const [key, value] of Object.entries(query))
    url.searchParams.set(key, value);
  return url;
}

describe("GET /api/statistics/games/:gameTypeKey/sections/:sectionId", () => {
  beforeEach(() => vi.clearAllMocks());

  it("404s on an unknown gameTypeKey", async () => {
    const response = await GET({
      locals,
      params: { gameTypeKey: "NOT_A_GAME", sectionId: "completion" },
      url: makeUrl("NOT_A_GAME", "completion", {
        from: "2026-01-01T00:00:00+01:00",
        to: "2026-02-01T00:00:00+01:00",
      }),
    } as never);

    expect(response.status).toBe(404);
    expect(getGameSection).not.toHaveBeenCalled();
  });

  it("404s on an unknown sectionId", async () => {
    const response = await GET({
      locals,
      params: { gameTypeKey: "501", sectionId: "not-a-real-section" },
      url: makeUrl("501", "not-a-real-section", {
        from: "2026-01-01T00:00:00+01:00",
        to: "2026-02-01T00:00:00+01:00",
      }),
    } as never);

    expect(response.status).toBe(404);
    expect(getGameSection).not.toHaveBeenCalled();
  });

  it("422s on a missing from (VALIDATION_FAILED)", async () => {
    const response = await GET({
      locals,
      params: { gameTypeKey: "501", sectionId: "completion" },
      url: makeUrl("501", "completion", { to: "2026-02-01T00:00:00+01:00" }),
    } as never);

    expect(response.status).toBe(422);
    const body = await response.json();
    expect(body.error.code).toBe("VALIDATION_FAILED");
  });

  it("calls the service with the parsed query and returns its response", async () => {
    const seriesResponse: CompletionSeriesResponseData = {
      sectionId: "completion",
      sectionVersion: 1,
      dataVersion: "v1:1:0",
      bucket: "none",
      tz: null,
      range: {
        from: "2026-01-01T00:00:00+01:00",
        to: "2026-02-01T00:00:00+01:00",
      },
      buckets: [
        {
          start: "2026-01-01T00:00:00+01:00",
          end: "2026-02-01T00:00:00+01:00",
          closed: true,
          sampleSize: 3,
          metrics: {
            completed: 3,
            abandoned: 0,
            neverStarted: 0,
            abandonedTurns: 0,
          },
        },
      ],
    };
    vi.mocked(getGameSection).mockResolvedValue({
      ok: true,
      data: seriesResponse,
    });

    const response = await GET({
      locals,
      params: { gameTypeKey: "501", sectionId: "completion" },
      url: makeUrl("501", "completion", {
        from: "2026-01-01T00:00:00+01:00",
        to: "2026-02-01T00:00:00+01:00",
      }),
    } as never);

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    const body = await response.json();
    expect(body.data).toEqual(seriesResponse);
    expect(CompletionSeriesResponse.safeParse(body.data).success).toBe(true);
    expect(getGameSection).toHaveBeenCalledWith(
      "player-1",
      "501",
      "completion",
      expect.objectContaining({
        from: "2026-01-01T00:00:00+01:00",
        to: "2026-02-01T00:00:00+01:00",
      }),
    );
  });
});
