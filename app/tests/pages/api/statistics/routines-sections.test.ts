import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@services/statistics.service", () => ({
  getRoutineSection: vi.fn(),
}));

import { getRoutineSection } from "@services/statistics.service";
import { GET } from "@routes/statistics/routines/[routineKey]/sections/[sectionId]";
import {
  RoutineVolumeSeriesResponse,
  RoutineCompletionSeriesResponse,
} from "@routes/types";
import type {
  RoutineVolumeSeriesResponseData,
  RoutineCompletionSeriesResponseData,
} from "@routes/types";

const locals = {
  requestId: "req-1",
  auth: { authUserId: "auth-1", playerId: "player-1" },
};

const routineKey = "0198f200-0000-7000-8000-000000000099";

function makeUrl(sectionId: string, query: Record<string, string>) {
  const url = new URL(
    `http://localhost/api/statistics/routines/${routineKey}/sections/${sectionId}`,
  );
  for (const [key, value] of Object.entries(query))
    url.searchParams.set(key, value);
  return url;
}

const validRange = {
  from: "2026-01-01T00:00:00+01:00",
  to: "2026-02-01T00:00:00+01:00",
};

describe("GET /api/statistics/routines/:routineKey/sections/:sectionId", () => {
  beforeEach(() => vi.clearAllMocks());

  it("422s on a missing from (VALIDATION_FAILED)", async () => {
    const response = await GET({
      locals,
      params: { routineKey, sectionId: "routine-volume" },
      url: makeUrl("routine-volume", { to: validRange.to }),
    } as never);

    expect(response.status).toBe(422);
    const body = await response.json();
    expect(body.error.code).toBe("VALIDATION_FAILED");
    expect(getRoutineSection).not.toHaveBeenCalled();
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
        params: { routineKey, sectionId: "routine-volume" },
        url: makeUrl("routine-volume", { ...validRange, [key]: value }),
      } as never);

      expect(response.status).toBe(422);
      const body = await response.json();
      expect(body.error.code).toBe("VALIDATION_FAILED");
      expect(getRoutineSection).not.toHaveBeenCalled();
    },
  );

  it("422s when the service reports a malformed routineKey", async () => {
    vi.mocked(getRoutineSection).mockResolvedValue({
      ok: false,
      code: "VALIDATION_FAILED",
      details: { reason: "routineKey is malformed" },
    });

    const response = await GET({
      locals,
      params: { routineKey: "not-a-routine-key", sectionId: "routine-volume" },
      url: makeUrl("routine-volume", validRange),
    } as never);

    expect(response.status).toBe(422);
    expect(getRoutineSection).toHaveBeenCalledWith(
      "player-1",
      "not-a-routine-key",
      "routine-volume",
      expect.objectContaining(validRange),
    );
  });

  it("404s when the service reports an unknown routine or section", async () => {
    vi.mocked(getRoutineSection).mockResolvedValue({
      ok: false,
      code: "NOT_FOUND",
    });

    const response = await GET({
      locals,
      params: { routineKey, sectionId: "not-a-real-section" },
      url: makeUrl("not-a-real-section", validRange),
    } as never);

    expect(response.status).toBe(404);
  });

  it("dispatches routine-volume through the service and returns a validated series", async () => {
    const seriesResponse: RoutineVolumeSeriesResponseData = {
      sectionId: "routine-volume",
      sectionVersion: 1,
      dataVersion: "v1:5:1736467200000",
      bucket: "none",
      tz: null,
      range: validRange,
      buckets: [
        {
          start: validRange.from,
          end: validRange.to,
          closed: true,
          sampleSize: 3,
          metrics: {
            runs: 3,
            durationSeconds: 900,
            minDurationSeconds: 200,
            maxDurationSeconds: 400,
            darts: 90,
          },
        },
      ],
    };
    vi.mocked(getRoutineSection).mockResolvedValue({
      ok: true,
      data: seriesResponse,
    });

    const response = await GET({
      locals,
      params: { routineKey, sectionId: "routine-volume" },
      url: makeUrl("routine-volume", validRange),
    } as never);

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    const body = await response.json();
    expect(body.data).toEqual(seriesResponse);
    expect(RoutineVolumeSeriesResponse.safeParse(body.data).success).toBe(true);
    expect(getRoutineSection).toHaveBeenCalledWith(
      "player-1",
      routineKey,
      "routine-volume",
      expect.objectContaining(validRange),
    );
  });

  it("dispatches routine-completion through the service and returns a validated series", async () => {
    const seriesResponse: RoutineCompletionSeriesResponseData = {
      sectionId: "routine-completion",
      sectionVersion: 1,
      dataVersion: "v1:5:1736467200000",
      bucket: "none",
      tz: null,
      range: validRange,
      buckets: [
        {
          start: validRange.from,
          end: validRange.to,
          closed: true,
          sampleSize: 3,
          metrics: {
            completed: 2,
            abandoned: 1,
            neverStarted: 0,
            stepsCompletedAtAbandon: { "1": 1 },
          },
        },
      ],
    };
    vi.mocked(getRoutineSection).mockResolvedValue({
      ok: true,
      data: seriesResponse,
    });

    const response = await GET({
      locals,
      params: { routineKey, sectionId: "routine-completion" },
      url: makeUrl("routine-completion", validRange),
    } as never);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data).toEqual(seriesResponse);
    expect(RoutineCompletionSeriesResponse.safeParse(body.data).success).toBe(
      true,
    );
  });
});
