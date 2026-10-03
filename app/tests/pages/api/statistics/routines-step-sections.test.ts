import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@services/statistics.service", () => ({
  getRoutineStepSection: vi.fn(),
}));

import { getRoutineStepSection } from "@services/statistics.service";
import { GET } from "@routes/statistics/routines/[routineKey]/steps/[stepKey]/sections/[sectionId]";
import {
  StepVolumeSeriesResponse,
  StepResultSeriesResponse,
  VolumeSeriesResponse,
} from "@routes/types";
import type {
  StepVolumeSeriesResponseData,
  StepResultSeriesResponseData,
  VolumeSeriesResponseData,
} from "@routes/types";

const locals = {
  requestId: "req-1",
  auth: { authUserId: "auth-1", playerId: "player-1" },
};

const routineKey = "0198f200-0000-7000-8000-000000000099";
const exerciseStepKey = `2-${"c".repeat(32)}`;
const gameStepKey = `1-${"a".repeat(32)}`;

function makeUrl(
  stepKey: string,
  sectionId: string,
  query: Record<string, string>,
) {
  const url = new URL(
    `http://localhost/api/statistics/routines/${routineKey}/steps/${stepKey}/sections/${sectionId}`,
  );
  for (const [key, value] of Object.entries(query))
    url.searchParams.set(key, value);
  return url;
}

const validRange = {
  from: "2026-01-01T00:00:00+01:00",
  to: "2026-02-01T00:00:00+01:00",
};

describe("GET /api/statistics/routines/:routineKey/steps/:stepKey/sections/:sectionId", () => {
  beforeEach(() => vi.clearAllMocks());

  it("422s on a missing from (VALIDATION_FAILED)", async () => {
    const response = await GET({
      locals,
      params: {
        routineKey,
        stepKey: exerciseStepKey,
        sectionId: "step-volume",
      },
      url: makeUrl(exerciseStepKey, "step-volume", { to: validRange.to }),
    } as never);

    expect(response.status).toBe(422);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    const body = await response.json();
    expect(body.error.code).toBe("VALIDATION_FAILED");
    expect(getRoutineStepSection).not.toHaveBeenCalled();
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
        params: {
          routineKey,
          stepKey: exerciseStepKey,
          sectionId: "step-volume",
        },
        url: makeUrl(exerciseStepKey, "step-volume", {
          ...validRange,
          [key]: value,
        }),
      } as never);

      expect(response.status).toBe(422);
      const body = await response.json();
      expect(body.error.code).toBe("VALIDATION_FAILED");
      expect(getRoutineStepSection).not.toHaveBeenCalled();
    },
  );

  it("422s when the service reports a malformed stepKey", async () => {
    vi.mocked(getRoutineStepSection).mockResolvedValue({
      ok: false,
      code: "VALIDATION_FAILED",
      details: { reason: "stepKey is malformed" },
    });

    const response = await GET({
      locals,
      params: {
        routineKey,
        stepKey: "not-a-step-key",
        sectionId: "step-volume",
      },
      url: makeUrl("not-a-step-key", "step-volume", validRange),
    } as never);

    expect(response.status).toBe(422);
    expect(getRoutineStepSection).toHaveBeenCalledWith(
      "player-1",
      routineKey,
      "not-a-step-key",
      "step-volume",
      expect.objectContaining(validRange),
    );
  });

  it("404s when the service reports an unknown step or section", async () => {
    vi.mocked(getRoutineStepSection).mockResolvedValue({
      ok: false,
      code: "NOT_FOUND",
    });

    const response = await GET({
      locals,
      params: {
        routineKey,
        stepKey: exerciseStepKey,
        sectionId: "not-a-real-section",
      },
      url: makeUrl(exerciseStepKey, "not-a-real-section", validRange),
    } as never);

    expect(response.status).toBe(404);
  });

  it("dispatches step-volume through the service and returns a validated series", async () => {
    const seriesResponse: StepVolumeSeriesResponseData = {
      sectionId: "step-volume",
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
          sampleSize: 4,
          metrics: { sessions: 4, durationSeconds: 600, darts: 40 },
        },
      ],
    };
    vi.mocked(getRoutineStepSection).mockResolvedValue({
      ok: true,
      data: seriesResponse,
    });

    const response = await GET({
      locals,
      params: {
        routineKey,
        stepKey: exerciseStepKey,
        sectionId: "step-volume",
      },
      url: makeUrl(exerciseStepKey, "step-volume", validRange),
    } as never);

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    const body = await response.json();
    expect(body.data).toEqual(seriesResponse);
    expect(StepVolumeSeriesResponse.safeParse(body.data).success).toBe(true);
    expect(getRoutineStepSection).toHaveBeenCalledWith(
      "player-1",
      routineKey,
      exerciseStepKey,
      "step-volume",
      expect.objectContaining(validRange),
    );
  });

  it("dispatches step-result through the service and returns a validated series", async () => {
    const seriesResponse: StepResultSeriesResponseData = {
      sectionId: "step-result",
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
          sampleSize: 4,
          metrics: {
            metrics: { points: 30, darts: 12, hits: 9 },
            headlineMin: 5,
            headlineMax: 15,
            sessions: 4,
            skippedSessions: 0,
          },
        },
      ],
    };
    vi.mocked(getRoutineStepSection).mockResolvedValue({
      ok: true,
      data: seriesResponse,
    });

    const response = await GET({
      locals,
      params: {
        routineKey,
        stepKey: exerciseStepKey,
        sectionId: "step-result",
      },
      url: makeUrl(exerciseStepKey, "step-result", validRange),
    } as never);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data).toEqual(seriesResponse);
    expect(StepResultSeriesResponse.safeParse(body.data).success).toBe(true);
  });

  it("dispatches a GAME step's own section through the service and returns a validated series", async () => {
    const seriesResponse: VolumeSeriesResponseData = {
      sectionId: "volume",
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
            sessions: { standalone: 0, routine: 3 },
            darts: { standalone: 0, routine: 90 },
            durationSeconds: { standalone: 0, routine: 900 },
          },
        },
      ],
    };
    vi.mocked(getRoutineStepSection).mockResolvedValue({
      ok: true,
      data: seriesResponse,
    });

    const response = await GET({
      locals,
      params: { routineKey, stepKey: gameStepKey, sectionId: "volume" },
      url: makeUrl(gameStepKey, "volume", validRange),
    } as never);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data).toEqual(seriesResponse);
    expect(VolumeSeriesResponse.safeParse(body.data).success).toBe(true);
    expect(getRoutineStepSection).toHaveBeenCalledWith(
      "player-1",
      routineKey,
      gameStepKey,
      "volume",
      expect.objectContaining(validRange),
    );
  });
});
