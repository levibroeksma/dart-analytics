import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@client/api/client", () => ({ apiRequest: vi.fn() }));

import { apiRequest } from "@client/api/client";
import {
  fetchStatisticsOverview,
  fetchGameSessions,
  fetchGameSection,
  fetchSessionReplay,
  fetchTrainedRoutines,
  fetchRoutineHeader,
  fetchRoutineSection,
  fetchRoutineStepSection,
  fetchRoutineStepSessions,
  StatisticsApiError,
} from "@client/api/statistics";

const SAMPLE = {
  totalGamesPlayed: 12,
  totalPlayTimeSeconds: 3600,
  favoriteGameTypeKey: "501",
  longestPlayStreakDays: 3,
  currentPlayStreakDays: 1,
  totalDartsThrown: 300,
  hundredPlusCount: 10,
  oneTwentyPlusCount: 5,
  oneFortyPlusCount: 2,
  oneEightiesCount: 1,
  medianVisitScore: 45,
  highestGameAverage: 65.5,
  firstNineCareerAverage: 50.2,
  scoringAverageExcludingDoubles: 48.1,
  bestLegDarts: 15,
  averageDartsPerLeg: 18.5,
  checkoutPercentage: 0.4,
  highestCheckout: { value: 100, timesHit: 2 },
};

describe("fetchStatisticsOverview", () => {
  beforeEach(() => vi.resetAllMocks());

  it("returns the parsed overview on success", async () => {
    vi.mocked(apiRequest).mockResolvedValue({
      ok: true,
      requestId: "r1",
      data: SAMPLE,
    });
    const result = await fetchStatisticsOverview();
    expect(result.totalGamesPlayed).toBe(12);
    expect(apiRequest).toHaveBeenCalledWith("/api/statistics/overview");
  });

  it("throws StatisticsApiError on failure", async () => {
    vi.mocked(apiRequest).mockResolvedValue({
      ok: false,
      requestId: "r1",
      error: {
        code: "UNAUTHORIZED",
        message: "Authentication required",
        retryable: false,
      },
    });
    await expect(fetchStatisticsOverview()).rejects.toBeInstanceOf(
      StatisticsApiError,
    );
  });
});

describe("fetchGameSessions", () => {
  beforeEach(() => vi.resetAllMocks());

  it("builds the query string and returns the session list", async () => {
    const listResponse = { items: [], nextCursor: null, dataVersion: "v1:0:0" };
    vi.mocked(apiRequest).mockResolvedValue({
      ok: true,
      requestId: "r1",
      data: listResponse,
    });

    const result = await fetchGameSessions("501", {
      from: "2026-01-01T00:00:00.000Z",
      to: "2026-02-01T00:00:00.000Z",
      bucket: "month",
      tz: "Europe/Amsterdam",
      limit: 10,
    });

    expect(result).toEqual(listResponse);
    const [path] = vi.mocked(apiRequest).mock.calls[0];
    expect(path).toContain("/api/statistics/games/501/sessions?");
    expect(path).toContain("from=2026-01-01T00%3A00%3A00.000Z");
    expect(path).toContain("to=2026-02-01T00%3A00%3A00.000Z");
    expect(path).toContain("bucket=month");
    expect(path).toContain("tz=Europe%2FAmsterdam");
    expect(path).toContain("limit=10");
  });

  it("throws StatisticsApiError on failure", async () => {
    vi.mocked(apiRequest).mockResolvedValue({
      ok: false,
      requestId: "r1",
      error: { code: "NOT_FOUND", message: "not found", retryable: false },
    });

    await expect(
      fetchGameSessions("501", {
        from: "2026-01-01T00:00:00.000Z",
        to: "2026-02-01T00:00:00.000Z",
      }),
    ).rejects.toBeInstanceOf(StatisticsApiError);
  });
});

describe("fetchGameSection", () => {
  beforeEach(() => vi.resetAllMocks());

  it("builds the query string and returns the section response", async () => {
    const seriesResponse = {
      sectionId: "completion",
      sectionVersion: 1,
      dataVersion: "v1:0:0",
      bucket: "month",
      tz: "Europe/Amsterdam",
      range: {
        from: "2026-01-01T00:00:00.000Z",
        to: "2026-02-01T00:00:00.000Z",
      },
      buckets: [],
    };
    vi.mocked(apiRequest).mockResolvedValue({
      ok: true,
      requestId: "r1",
      data: seriesResponse,
    });

    const result = await fetchGameSection("501", "completion", {
      from: "2026-01-01T00:00:00.000Z",
      to: "2026-02-01T00:00:00.000Z",
      bucket: "month",
      tz: "Europe/Amsterdam",
    });

    expect(result).toEqual(seriesResponse);
    const [path] = vi.mocked(apiRequest).mock.calls[0];
    expect(path).toContain("/api/statistics/games/501/sections/completion?");
    expect(path).toContain("bucket=month");
  });

  it("throws StatisticsApiError on failure", async () => {
    vi.mocked(apiRequest).mockResolvedValue({
      ok: false,
      requestId: "r1",
      error: { code: "NOT_FOUND", message: "not found", retryable: false },
    });

    await expect(
      fetchGameSection("501", "completion", {
        from: "2026-01-01T00:00:00.000Z",
        to: "2026-02-01T00:00:00.000Z",
      }),
    ).rejects.toBeInstanceOf(StatisticsApiError);
  });

  it("includes target in the query string when given", async () => {
    vi.mocked(apiRequest).mockResolvedValue({
      ok: true,
      requestId: "r1",
      data: {
        sectionId: "heatmap",
        sectionVersion: 1,
        dataVersion: "v1:0:0",
        bucket: "none",
        tz: null,
        range: {
          from: "2026-01-01T00:00:00.000Z",
          to: "2026-02-01T00:00:00.000Z",
        },
        buckets: [],
      },
    });

    await fetchGameSection("DOUBLES_TRAINING", "heatmap", {
      from: "2026-01-01T00:00:00.000Z",
      to: "2026-02-01T00:00:00.000Z",
      target: "DOUBLE:16",
    });

    const [path] = vi.mocked(apiRequest).mock.calls[0];
    expect(path).toContain("target=DOUBLE%3A16");
  });
});

describe("fetchSessionReplay", () => {
  beforeEach(() => vi.resetAllMocks());

  const pageResponse = {
    header: null,
    turns: [],
    nextCursor: null,
  };

  it("omits cursor and limit from the query when absent", async () => {
    vi.mocked(apiRequest).mockResolvedValue({
      ok: true,
      requestId: "r1",
      data: pageResponse,
    });

    const result = await fetchSessionReplay(
      "11111111-1111-1111-1111-111111111111",
    );

    expect(result).toEqual(pageResponse);
    const [path] = vi.mocked(apiRequest).mock.calls[0];
    expect(path).toBe(
      "/api/statistics/sessions/11111111-1111-1111-1111-111111111111/replay?",
    );
  });

  it("includes cursor and limit in the query when given", async () => {
    vi.mocked(apiRequest).mockResolvedValue({
      ok: true,
      requestId: "r1",
      data: pageResponse,
    });

    await fetchSessionReplay("11111111-1111-1111-1111-111111111111", {
      cursor: "v1:abc:2",
      limit: 10,
    });

    const [path] = vi.mocked(apiRequest).mock.calls[0];
    expect(path).toContain("cursor=v1%3Aabc%3A2");
    expect(path).toContain("limit=10");
  });

  it("encodes the session id into one path segment, so a ../ id cannot leave the replay route", async () => {
    vi.mocked(apiRequest).mockResolvedValue({
      ok: true,
      requestId: "r1",
      data: pageResponse,
    });

    await fetchSessionReplay("../../profile#");

    const [path] = vi.mocked(apiRequest).mock.calls[0];
    expect(path).toBe("/api/statistics/sessions/..%2F..%2Fprofile%23/replay?");
    expect(new URL(path as string, "https://app.test").pathname).toBe(
      "/api/statistics/sessions/..%2F..%2Fprofile%23/replay",
    );
  });

  it("throws StatisticsApiError on failure", async () => {
    vi.mocked(apiRequest).mockResolvedValue({
      ok: false,
      requestId: "r1",
      error: { code: "NOT_FOUND", message: "not found", retryable: false },
    });

    await expect(
      fetchSessionReplay("11111111-1111-1111-1111-111111111111"),
    ).rejects.toBeInstanceOf(StatisticsApiError);
  });
});

describe("fetchTrainedRoutines", () => {
  beforeEach(() => vi.resetAllMocks());

  it("fetches the routine list with no query string", async () => {
    const listResponse = { items: [] };
    vi.mocked(apiRequest).mockResolvedValue({
      ok: true,
      requestId: "r1",
      data: listResponse,
    });

    const result = await fetchTrainedRoutines();

    expect(result).toEqual(listResponse);
    expect(apiRequest).toHaveBeenCalledWith("/api/statistics/routines");
  });

  it("throws StatisticsApiError on failure", async () => {
    vi.mocked(apiRequest).mockResolvedValue({
      ok: false,
      requestId: "r1",
      error: { code: "UNAUTHORIZED", message: "nope", retryable: false },
    });

    await expect(fetchTrainedRoutines()).rejects.toBeInstanceOf(
      StatisticsApiError,
    );
  });
});

describe("fetchRoutineHeader", () => {
  beforeEach(() => vi.resetAllMocks());

  const header = {
    routineKey: "R1",
    routineName: "Leg Day",
    runCount: 4,
    firstRunAt: "2026-01-01T00:00:00.000Z",
    lastRunAt: "2026-02-01T00:00:00.000Z",
    dataVersion: "v1:4:0",
    steps: [],
  };

  it("fetches one routine's header with no query string", async () => {
    vi.mocked(apiRequest).mockResolvedValue({
      ok: true,
      requestId: "r1",
      data: header,
    });

    const result = await fetchRoutineHeader("R1");

    expect(result).toEqual(header);
    expect(apiRequest).toHaveBeenCalledWith("/api/statistics/routines/R1");
  });

  it("encodes the routine key into its own path segment, so a ../ key cannot leave the route", async () => {
    vi.mocked(apiRequest).mockResolvedValue({
      ok: true,
      requestId: "r1",
      data: header,
    });

    await fetchRoutineHeader("../../profile#");

    const [path] = vi.mocked(apiRequest).mock.calls[0];
    expect(new URL(path as string, "https://app.test").pathname).toBe(
      "/api/statistics/routines/..%2F..%2Fprofile%23",
    );
  });

  it("throws StatisticsApiError on failure", async () => {
    vi.mocked(apiRequest).mockResolvedValue({
      ok: false,
      requestId: "r1",
      error: { code: "NOT_FOUND", message: "not found", retryable: false },
    });

    await expect(fetchRoutineHeader("R1")).rejects.toBeInstanceOf(
      StatisticsApiError,
    );
  });
});

describe("fetchRoutineSection", () => {
  beforeEach(() => vi.resetAllMocks());

  const seriesResponse = {
    sectionId: "routine-volume",
    sectionVersion: 1,
    dataVersion: "v1:1:0",
    bucket: "month",
    tz: "Europe/Amsterdam",
    range: {
      from: "2026-01-01T00:00:00.000Z",
      to: "2026-02-01T00:00:00.000Z",
    },
    buckets: [],
  };

  it("builds the path and query with no context, inputMode or target", async () => {
    vi.mocked(apiRequest).mockResolvedValue({
      ok: true,
      requestId: "r1",
      data: seriesResponse,
    });

    const result = await fetchRoutineSection("R1", "routine-volume", {
      from: "2026-01-01T00:00:00.000Z",
      to: "2026-02-01T00:00:00.000Z",
      bucket: "month",
      tz: "Europe/Amsterdam",
    });

    expect(result).toEqual(seriesResponse);
    const [path] = vi.mocked(apiRequest).mock.calls[0];
    expect(path).toContain(
      "/api/statistics/routines/R1/sections/routine-volume?",
    );
    expect(path).toContain("bucket=month");
    expect(path).toContain("tz=Europe%2FAmsterdam");
    expect(path).not.toContain("context");
    expect(path).not.toContain("inputMode");
    expect(path).not.toContain("target");
  });

  it("throws StatisticsApiError on failure", async () => {
    vi.mocked(apiRequest).mockResolvedValue({
      ok: false,
      requestId: "r1",
      error: { code: "NOT_FOUND", message: "not found", retryable: false },
    });

    await expect(
      fetchRoutineSection("R1", "routine-volume", {
        from: "2026-01-01T00:00:00.000Z",
        to: "2026-02-01T00:00:00.000Z",
      }),
    ).rejects.toBeInstanceOf(StatisticsApiError);
  });
});

describe("fetchRoutineStepSection", () => {
  beforeEach(() => vi.resetAllMocks());

  const seriesResponse = {
    sectionId: "step-result",
    sectionVersion: 1,
    dataVersion: "v1:1:0",
    bucket: "none",
    tz: null,
    range: {
      from: "2026-01-01T00:00:00.000Z",
      to: "2026-02-01T00:00:00.000Z",
    },
    buckets: [],
  };

  it("builds the path and query with no context, inputMode or target", async () => {
    vi.mocked(apiRequest).mockResolvedValue({
      ok: true,
      requestId: "r1",
      data: seriesResponse,
    });

    const result = await fetchRoutineStepSection("R1", "1-abc", "step-result", {
      from: "2026-01-01T00:00:00.000Z",
      to: "2026-02-01T00:00:00.000Z",
    });

    expect(result).toEqual(seriesResponse);
    const [path] = vi.mocked(apiRequest).mock.calls[0];
    expect(path).toContain(
      "/api/statistics/routines/R1/steps/1-abc/sections/step-result?",
    );
    expect(path).not.toContain("context");
    expect(path).not.toContain("inputMode");
    expect(path).not.toContain("target");
  });

  it("encodes the routine key and step key into their own path segments", async () => {
    vi.mocked(apiRequest).mockResolvedValue({
      ok: true,
      requestId: "r1",
      data: seriesResponse,
    });

    await fetchRoutineStepSection("../x", "../y", "step-result", {
      from: "2026-01-01T00:00:00.000Z",
      to: "2026-02-01T00:00:00.000Z",
    });

    const [path] = vi.mocked(apiRequest).mock.calls[0];
    expect(new URL(path as string, "https://app.test").pathname).toBe(
      "/api/statistics/routines/..%2Fx/steps/..%2Fy/sections/step-result",
    );
  });

  it("throws StatisticsApiError on failure", async () => {
    vi.mocked(apiRequest).mockResolvedValue({
      ok: false,
      requestId: "r1",
      error: { code: "NOT_FOUND", message: "not found", retryable: false },
    });

    await expect(
      fetchRoutineStepSection("R1", "1-abc", "step-result", {
        from: "2026-01-01T00:00:00.000Z",
        to: "2026-02-01T00:00:00.000Z",
      }),
    ).rejects.toBeInstanceOf(StatisticsApiError);
  });
});

describe("fetchRoutineStepSessions", () => {
  beforeEach(() => vi.resetAllMocks());

  it("builds the path and query for a step's session list", async () => {
    const listResponse = { items: [], nextCursor: null, dataVersion: "v1:0:0" };
    vi.mocked(apiRequest).mockResolvedValue({
      ok: true,
      requestId: "r1",
      data: listResponse,
    });

    const result = await fetchRoutineStepSessions("R1", "1-abc", {
      from: "2026-01-01T00:00:00.000Z",
      to: "2026-02-01T00:00:00.000Z",
      limit: 10,
    });

    expect(result).toEqual(listResponse);
    const [path] = vi.mocked(apiRequest).mock.calls[0];
    expect(path).toContain("/api/statistics/routines/R1/steps/1-abc/sessions?");
    expect(path).toContain("limit=10");
    expect(path).not.toContain("context");
    expect(path).not.toContain("bucket");
    expect(path).not.toContain("inputMode");
    expect(path).not.toContain("target");
  });

  it("throws StatisticsApiError on failure", async () => {
    vi.mocked(apiRequest).mockResolvedValue({
      ok: false,
      requestId: "r1",
      error: { code: "NOT_FOUND", message: "not found", retryable: false },
    });

    await expect(
      fetchRoutineStepSessions("R1", "1-abc", {
        from: "2026-01-01T00:00:00.000Z",
        to: "2026-02-01T00:00:00.000Z",
      }),
    ).rejects.toBeInstanceOf(StatisticsApiError);
  });
});
