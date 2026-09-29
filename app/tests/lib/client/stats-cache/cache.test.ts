import "fake-indexeddb/auto";
import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  readSection,
  readSessionPage,
  readReplayPage,
  clearStatsCache,
  missingSpans,
  noteDataVersion,
} from "@client/stats-cache/cache";
import { STATS_DB_NAME } from "@client/stats-cache/db";
import { ROUTINE_SECTIONS, SECTIONS } from "@lib/stats/section-registry";
import {
  gameScopeKey,
  routineScopeKey,
  stepScopeKey,
} from "@modules/stats/routine-scope.module";
import type { GameTypeKey, RoutineSectionMeta, SectionMeta } from "@lib/types";
import type { CachedSeries, CacheScope } from "@client/types";

/** A game page's scope for `gameTypeKey`, as `game-stats.store.ts` builds it (controller ruling R4). */
function gameScope(gameTypeKey: string): CacheScope {
  const key = gameTypeKey as GameTypeKey;
  return { key: gameScopeKey(key), gameTypeKey: key };
}

function deleteStatsDb(): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(STATS_DB_NAME);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

const meta: SectionMeta = {
  id: "completion",
  version: 1,
  requires: [],
  computeSite: "sql",
  bucketable: true,
  includesAbandoned: true,
  configSensitive: [],
  params: [],
};

type Metrics = { completed: number };

function bucket(start: string, end: string, closed: boolean, completed = 1) {
  return { start, end, closed, sampleSize: completed, metrics: { completed } };
}

function response(
  from: string,
  to: string,
  buckets: ReturnType<typeof bucket>[],
  dataVersion = "v1:1:0",
): CachedSeries<Metrics> {
  return {
    sectionId: "completion",
    sectionVersion: 1,
    dataVersion,
    bucket: "month",
    tz: "Europe/Amsterdam",
    range: { from, to },
    buckets,
  };
}

const baseQuery = {
  bucket: "month" as const,
  tz: "Europe/Amsterdam",
  context: "all" as const,
  inputMode: "VISUAL_BOARD",
  from: "2026-01-01T00:00:00.000Z",
  to: "2026-04-01T00:00:00.000Z",
};

describe("readSection (bucketed)", () => {
  beforeEach(() => deleteStatsDb());

  it("fetches the whole range on the first read and stores the closed buckets", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(
        response("2026-01-01T00:00:00.000Z", "2026-04-01T00:00:00.000Z", [
          bucket("2026-01-01T00:00:00.000Z", "2026-02-01T00:00:00.000Z", true),
          bucket("2026-02-01T00:00:00.000Z", "2026-03-01T00:00:00.000Z", true),
          bucket("2026-03-01T00:00:00.000Z", "2026-04-01T00:00:00.000Z", false),
        ]),
      );

    const result = await readSection(
      "p1",
      gameScope("501"),
      meta,
      baseQuery,
      fetcher,
    );

    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher).toHaveBeenCalledWith({
      from: baseQuery.from,
      to: baseQuery.to,
    });
    expect(result.buckets).toHaveLength(3);
  });

  it("a second identical read fetches only the still-open tail", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(
        response("2026-01-01T00:00:00.000Z", "2026-04-01T00:00:00.000Z", [
          bucket("2026-01-01T00:00:00.000Z", "2026-02-01T00:00:00.000Z", true),
          bucket("2026-02-01T00:00:00.000Z", "2026-03-01T00:00:00.000Z", true),
          bucket("2026-03-01T00:00:00.000Z", "2026-04-01T00:00:00.000Z", false),
        ]),
      );

    await readSection("p1", gameScope("501"), meta, baseQuery, fetcher);
    fetcher.mockClear();
    fetcher.mockResolvedValue(
      response("2026-03-01T00:00:00.000Z", "2026-04-01T00:00:00.000Z", [
        bucket("2026-03-01T00:00:00.000Z", "2026-04-01T00:00:00.000Z", true),
      ]),
    );

    const result = await readSection(
      "p1",
      gameScope("501"),
      meta,
      baseQuery,
      fetcher,
    );

    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher).toHaveBeenCalledWith({
      from: "2026-03-01T00:00:00.000Z",
      to: baseQuery.to,
    });
    expect(result.buckets.every((b) => b.closed)).toBe(true);
    expect(result.buckets).toHaveLength(3);
  });

  it("widening from earlier fetches only the earlier span", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(
        response("2026-02-01T00:00:00.000Z", "2026-04-01T00:00:00.000Z", [
          bucket("2026-02-01T00:00:00.000Z", "2026-03-01T00:00:00.000Z", true),
          bucket("2026-03-01T00:00:00.000Z", "2026-04-01T00:00:00.000Z", true),
        ]),
      );
    await readSection(
      "p1",
      gameScope("501"),
      meta,
      { ...baseQuery, from: "2026-02-01T00:00:00.000Z" },
      fetcher,
    );
    fetcher.mockClear();
    fetcher.mockResolvedValue(
      response("2026-01-01T00:00:00.000Z", "2026-02-01T00:00:00.000Z", [
        bucket("2026-01-01T00:00:00.000Z", "2026-02-01T00:00:00.000Z", true),
      ]),
    );

    const result = await readSection(
      "p1",
      gameScope("501"),
      meta,
      baseQuery,
      fetcher,
    );

    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher).toHaveBeenCalledWith({
      from: baseQuery.from,
      to: "2026-02-01T00:00:00.000Z",
    });
    expect(result.buckets).toHaveLength(3);
  });

  it("misses the cache when the section version bumps", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(
        response(baseQuery.from, baseQuery.to, [
          bucket("2026-01-01T00:00:00.000Z", "2026-02-01T00:00:00.000Z", true),
        ]),
      );
    await readSection("p1", gameScope("501"), meta, baseQuery, fetcher);
    fetcher.mockClear();
    fetcher.mockResolvedValue(
      response(baseQuery.from, baseQuery.to, [
        bucket("2026-01-01T00:00:00.000Z", "2026-02-01T00:00:00.000Z", true),
      ]),
    );

    await readSection(
      "p1",
      gameScope("501"),
      { ...meta, version: 2 },
      baseQuery,
      fetcher,
    );

    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("calls the fetcher every time when IndexedDB is unavailable and still returns data", async () => {
    const original = globalThis.indexedDB;
    // @ts-expect-error simulating an environment without IndexedDB
    delete globalThis.indexedDB;
    const fetcher = vi
      .fn()
      .mockResolvedValue(
        response(baseQuery.from, baseQuery.to, [
          bucket("2026-01-01T00:00:00.000Z", "2026-02-01T00:00:00.000Z", true),
        ]),
      );

    await readSection("p1", gameScope("501"), meta, baseQuery, fetcher);
    const result = await readSection(
      "p1",
      gameScope("501"),
      meta,
      baseQuery,
      fetcher,
    );

    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(result.buckets).toHaveLength(1);
    globalThis.indexedDB = original;
  });
});

describe("readSection (bucket=none)", () => {
  beforeEach(() => deleteStatsDb());

  const noneQuery = {
    bucket: "none" as const,
    context: "all" as const,
    inputMode: "VISUAL_BOARD",
    from: "2026-01-01T00:00:00.000Z",
    to: "2026-04-01T00:00:00.000Z",
  };

  it("serves from the cache when the data version has not changed", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(
        response(noneQuery.from, noneQuery.to, [
          bucket(noneQuery.from, noneQuery.to, true, 5),
        ]),
      );

    await readSection("p1", gameScope("501"), meta, noneQuery, fetcher);
    const second = await readSection(
      "p1",
      gameScope("501"),
      meta,
      noneQuery,
      fetcher,
    );

    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(second.dataVersion).toBe("v1:1:0");
  });

  it("refetches once the data version changes", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(
        response(noneQuery.from, noneQuery.to, [
          bucket(noneQuery.from, noneQuery.to, true, 5),
        ]),
      )
      .mockResolvedValueOnce(
        response(
          noneQuery.from,
          noneQuery.to,
          [bucket(noneQuery.from, noneQuery.to, true, 6)],
          "v1:2:0",
        ),
      );

    await readSection("p1", gameScope("501"), meta, noneQuery, fetcher);
    await readSection("p1", gameScope("other-game"), meta, noneQuery, fetcher);
    const third = await readSection(
      "p1",
      gameScope("501"),
      meta,
      noneQuery,
      fetcher,
    );

    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(third.dataVersion).toBe("v1:1:0");
  });
});

const serverMeta: SectionMeta = {
  id: "checkout-rate",
  version: 1,
  requires: [],
  computeSite: "server",
  bucketable: true,
  includesAbandoned: false,
  configSensitive: [],
  params: [],
};

type CheckoutRateLike = Record<string, { chances: number; finished: number }>;

describe("readSection (server)", () => {
  beforeEach(() => deleteStatsDb());

  it("fetches every month chunk, then only the still-open one on a later read", async () => {
    const query = {
      bucket: "month" as const,
      tz: "UTC",
      context: "all" as const,
      inputMode: "VISUAL_BOARD",
      from: "2026-01-01T00:00:00.000Z",
      to: "2027-01-01T00:00:00.000Z",
    };
    const fetcher = vi
      .fn()
      .mockImplementation(
        (span: { from: string; to: string; bucket: string }) =>
          Promise.resolve(
            response(span.from, span.to, [bucket(span.from, span.to, true, 1)]),
          ),
      );

    const first = await readSection(
      "p1",
      gameScope("501"),
      serverMeta,
      query,
      fetcher,
      new Date("2026-12-15T00:00:00.000Z"),
    );
    expect(fetcher).toHaveBeenCalledTimes(12);
    expect(fetcher.mock.calls[0]![0]).toEqual({
      from: "2026-01-01T00:00:00.000Z",
      to: "2026-02-01T00:00:00.000Z",
      bucket: "month",
    });
    expect(first.buckets).toHaveLength(12);

    fetcher.mockClear();
    const second = await readSection(
      "p1",
      gameScope("501"),
      serverMeta,
      query,
      fetcher,
      new Date("2026-12-20T00:00:00.000Z"),
    );
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher).toHaveBeenCalledWith({
      from: "2026-12-01T00:00:00.000Z",
      to: "2027-01-01T00:00:00.000Z",
      bucket: "month",
    });
    expect(second.buckets).toHaveLength(12);
  });

  it("merges bucket=none chunks into one aggregate bucket", async () => {
    const query = {
      bucket: "none" as const,
      context: "all" as const,
      inputMode: "VISUAL_BOARD",
      from: "2026-01-01T00:00:00.000Z",
      to: "2026-03-01T00:00:00.000Z",
    };
    const fetcher = vi
      .fn()
      .mockImplementation((span: { from: string; to: string }) =>
        Promise.resolve({
          sectionId: "checkout-rate",
          sectionVersion: 1,
          dataVersion: "v1:1:0",
          bucket: "none" as const,
          tz: null,
          range: { from: span.from, to: span.to },
          buckets: [
            {
              start: span.from,
              end: span.to,
              closed: true,
              sampleSize: 1,
              metrics: (span.from === "2026-01-01T00:00:00.000Z"
                ? { "170": { chances: 1, finished: 1 } }
                : { "170": { chances: 2, finished: 0 } }) as CheckoutRateLike,
            },
          ],
        }),
      );

    const result = await readSection(
      "p1",
      gameScope("501"),
      serverMeta,
      query,
      fetcher,
      new Date("2026-04-01T00:00:00.000Z"),
    );

    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(result.buckets).toHaveLength(1);
    expect(result.buckets[0]!.metrics).toEqual({
      "170": { chances: 3, finished: 1 },
    });
    expect(result.buckets[0]!.sampleSize).toBe(2);
    expect(result.buckets[0]!.start).toBe("2026-01-01T00:00:00.000Z");
    expect(result.buckets[0]!.end).toBe("2026-03-01T00:00:00.000Z");
  });

  it("regroups a year view's month chunks and requests them at month granularity", async () => {
    const query = {
      bucket: "year" as const,
      tz: "UTC",
      context: "all" as const,
      inputMode: "VISUAL_BOARD",
      from: "2026-01-01T00:00:00.000Z",
      to: "2027-01-01T00:00:00.000Z",
    };
    const fetcher = vi
      .fn()
      .mockImplementation(
        (span: { from: string; to: string; bucket: string }) =>
          Promise.resolve({
            sectionId: "checkout-rate",
            sectionVersion: 1,
            dataVersion: "v1:1:0",
            bucket: span.bucket,
            tz: "UTC",
            range: { from: span.from, to: span.to },
            buckets: [
              {
                start: span.from,
                end: span.to,
                closed: true,
                sampleSize: 1,
                metrics: {
                  "170": { chances: 1, finished: 1 },
                } as CheckoutRateLike,
              },
            ],
          }),
      );

    const result = await readSection(
      "p1",
      gameScope("501"),
      serverMeta,
      query,
      fetcher,
      new Date("2027-06-01T00:00:00.000Z"),
    );

    expect(fetcher).toHaveBeenCalledTimes(12);
    expect(fetcher.mock.calls[0]![0]).toMatchObject({ bucket: "month" });
    expect(result.buckets).toHaveLength(1);
    expect(result.buckets[0]!.start).toBe("2026-01-01T00:00:00.000Z");
    expect(result.buckets[0]!.end).toBe("2027-01-01T00:00:00.000Z");
    expect(result.buckets[0]!.metrics).toEqual({
      "170": { chances: 12, finished: 12 },
    });
  });

  it("sums skippedSessions across every fetched chunk", async () => {
    const query = {
      bucket: "month" as const,
      tz: "UTC",
      context: "all" as const,
      inputMode: "VISUAL_BOARD",
      from: "2026-01-01T00:00:00.000Z",
      to: "2026-03-01T00:00:00.000Z",
    };
    const fetcher = vi
      .fn()
      .mockImplementation((span: { from: string; to: string }) =>
        Promise.resolve({
          ...response(span.from, span.to, [
            bucket(span.from, span.to, true, 1),
          ]),
          skippedSessions: span.from === "2026-01-01T00:00:00.000Z" ? 2 : 1,
        }),
      );

    const result = await readSection(
      "p1",
      gameScope("501"),
      serverMeta,
      query,
      fetcher,
      new Date("2026-04-01T00:00:00.000Z"),
    );

    expect(result.skippedSessions).toBe(3);
  });

  it("propagates a fetcher rejection (VALIDATION_FAILED) without fetching further chunks", async () => {
    const query = {
      bucket: "month" as const,
      tz: "UTC",
      context: "all" as const,
      inputMode: "VISUAL_BOARD",
      from: "2026-01-01T00:00:00.000Z",
      to: "2026-04-01T00:00:00.000Z",
    };
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(
        response("2026-01-01T00:00:00.000Z", "2026-02-01T00:00:00.000Z", [
          bucket(
            "2026-01-01T00:00:00.000Z",
            "2026-02-01T00:00:00.000Z",
            true,
            1,
          ),
        ]),
      )
      .mockRejectedValueOnce(new Error("VALIDATION_FAILED"));

    await expect(
      readSection(
        "p1",
        gameScope("501"),
        serverMeta,
        query,
        fetcher,
        new Date("2026-05-01T00:00:00.000Z"),
      ),
    ).rejects.toThrow("VALIDATION_FAILED");
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
});

describe("readSection (site resolved per game, phase-4 decision 5)", () => {
  beforeEach(() => deleteStatsDb());

  it("chunks target-accuracy by month on SHANGHAI, whose intent-derived tag resolves it to server", async () => {
    const query = {
      bucket: "month" as const,
      tz: "UTC",
      context: "all" as const,
      inputMode: "VISUAL_BOARD",
      from: "2026-01-01T00:00:00.000Z",
      to: "2026-03-01T00:00:00.000Z",
    };
    const fetcher = vi
      .fn()
      .mockImplementation((span: { from: string; to: string }) =>
        Promise.resolve(
          response(span.from, span.to, [bucket(span.from, span.to, true, 1)]),
        ),
      );

    const result = await readSection(
      "p1",
      gameScope("SHANGHAI"),
      SECTIONS["target-accuracy"],
      query,
      fetcher,
      new Date("2026-04-01T00:00:00.000Z"),
    );

    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(fetcher.mock.calls[0]![0]).toEqual({
      from: "2026-01-01T00:00:00.000Z",
      to: "2026-02-01T00:00:00.000Z",
      bucket: "month",
    });
    expect(result.buckets).toHaveLength(2);
  });

  it("does not chunk target-accuracy on DOUBLES_TRAINING, whose only intent tag resolves it to sql", async () => {
    const query = {
      bucket: "month" as const,
      tz: "UTC",
      context: "all" as const,
      inputMode: "VISUAL_BOARD",
      from: "2026-01-01T00:00:00.000Z",
      to: "2026-03-01T00:00:00.000Z",
    };
    const fetcher = vi
      .fn()
      .mockResolvedValue(
        response(query.from, query.to, [
          bucket("2026-01-01T00:00:00.000Z", "2026-02-01T00:00:00.000Z", true),
          bucket("2026-02-01T00:00:00.000Z", "2026-03-01T00:00:00.000Z", true),
        ]),
      );

    const result = await readSection(
      "p1",
      gameScope("DOUBLES_TRAINING"),
      SECTIONS["target-accuracy"],
      query,
      fetcher,
      new Date("2026-04-01T00:00:00.000Z"),
    );

    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher).toHaveBeenCalledWith({ from: query.from, to: query.to });
    expect(result.buckets).toHaveLength(2);
  });
});

const routineVolumeMeta: RoutineSectionMeta = {
  id: "routine-volume",
  version: 1,
  requires: [],
  computeSite: "sql",
  bucketable: true,
  includesAbandoned: false,
  configSensitive: [],
  params: [],
  surface: "routine",
};

const stepVolumeMeta: RoutineSectionMeta = {
  ...routineVolumeMeta,
  id: "step-volume",
  surface: "step",
};

describe("readSection (scope key partitions the cache, controller ruling R4)", () => {
  beforeEach(() => deleteStatsDb());

  it("a game scope and a routine step scope for the same game do not share entries", async () => {
    const query = { ...baseQuery };
    const fetcherGame = vi
      .fn()
      .mockResolvedValue(
        response(query.from, query.to, [bucket(query.from, query.to, true, 1)]),
      );
    const fetcherStep = vi
      .fn()
      .mockResolvedValue(
        response(query.from, query.to, [bucket(query.from, query.to, true, 1)]),
      );

    await readSection(
      "p1",
      gameScope("501"),
      SECTIONS.volume,
      query,
      fetcherGame,
    );
    await readSection(
      "p1",
      {
        key: stepScopeKey("routine-1", "1-abc"),
        gameTypeKey: "501" as GameTypeKey,
      },
      SECTIONS.volume,
      query,
      fetcherStep,
    );

    expect(fetcherGame).toHaveBeenCalledTimes(1);
    expect(fetcherStep).toHaveBeenCalledTimes(1);
  });

  it("two steps of one routine do not share entries", async () => {
    const query = { ...baseQuery };
    const fetcher1 = vi
      .fn()
      .mockResolvedValue(
        response(query.from, query.to, [bucket(query.from, query.to, true, 1)]),
      );
    const fetcher2 = vi
      .fn()
      .mockResolvedValue(
        response(query.from, query.to, [bucket(query.from, query.to, true, 1)]),
      );

    const step1: CacheScope = {
      key: stepScopeKey("routine-1", "1-abc"),
      gameTypeKey: null,
    };
    const step2: CacheScope = {
      key: stepScopeKey("routine-1", "2-def"),
      gameTypeKey: null,
    };

    await readSection("p1", step1, stepVolumeMeta, query, fetcher1);
    await readSection("p1", step2, stepVolumeMeta, query, fetcher2);

    expect(fetcher1).toHaveBeenCalledTimes(1);
    expect(fetcher2).toHaveBeenCalledTimes(1);
  });
});

describe("readSection (bucket=none, routine dataVersion propagation, controller ruling R23)", () => {
  beforeEach(() => deleteStatsDb());

  const noneQuery = {
    bucket: "none" as const,
    context: "all" as const,
    inputMode: "VISUAL_BOARD",
    from: "2026-01-01T00:00:00.000Z",
    to: "2026-04-01T00:00:00.000Z",
  };
  const widerQuery = { ...noneQuery, to: "2026-05-01T00:00:00.000Z" };

  /** A routine scope and one of its step scopes, both sharing `versionKey` (R23): the routine's own token, never the step's own key. */
  function routineAndStepScope(
    routineKey: string,
    stepKey: string,
  ): { routineScope: CacheScope; stepScope: CacheScope } {
    const versionKey = routineScopeKey(routineKey);
    return {
      routineScope: { key: versionKey, gameTypeKey: null, versionKey },
      stepScope: {
        key: stepScopeKey(routineKey, stepKey),
        gameTypeKey: null,
        versionKey,
      },
    };
  }

  it("a routine section fetch that returns a new token refetches the routine and its steps, leaving a game scope untouched", async () => {
    const { routineScope, stepScope } = routineAndStepScope(
      "routine-1",
      "1-abc",
    );
    const game = gameScope("501");

    const routineFetcher = vi
      .fn()
      .mockResolvedValueOnce(
        response(
          noneQuery.from,
          noneQuery.to,
          [bucket(noneQuery.from, noneQuery.to, true, 1)],
          "v1:1:100",
        ),
      )
      .mockResolvedValueOnce(
        response(
          widerQuery.from,
          widerQuery.to,
          [bucket(widerQuery.from, widerQuery.to, true, 1)],
          "v1:2:200",
        ),
      );
    const stepFetcher = vi
      .fn()
      .mockResolvedValue(
        response(
          noneQuery.from,
          noneQuery.to,
          [bucket(noneQuery.from, noneQuery.to, true, 1)],
          "v1:1:100",
        ),
      );
    const gameFetcher = vi
      .fn()
      .mockResolvedValue(
        response(
          noneQuery.from,
          noneQuery.to,
          [bucket(noneQuery.from, noneQuery.to, true, 1)],
          "g1:9:9",
        ),
      );

    await readSection(
      "p1",
      routineScope,
      routineVolumeMeta,
      noneQuery,
      routineFetcher,
    );
    await readSection("p1", stepScope, stepVolumeMeta, noneQuery, stepFetcher);
    await readSection("p1", game, SECTIONS.volume, noneQuery, gameFetcher);
    stepFetcher.mockClear();
    gameFetcher.mockClear();

    // A wider routine-level read is a genuine cache miss on its own entry
    // (bucket=none keys by from/to too) and returns a fresh token, which the
    // step scope shares via `versionKey` (R23) even though it was never
    // fetched directly.
    await readSection(
      "p1",
      routineScope,
      routineVolumeMeta,
      widerQuery,
      routineFetcher,
    );

    await readSection("p1", stepScope, stepVolumeMeta, noneQuery, stepFetcher);
    await readSection("p1", game, SECTIONS.volume, noneQuery, gameFetcher);

    expect(routineFetcher).toHaveBeenCalledTimes(2);
    expect(stepFetcher).toHaveBeenCalledTimes(1);
    expect(gameFetcher).toHaveBeenCalledTimes(0);
  });

  it("noteDataVersion refetches the routine and its steps, leaving a game scope untouched", async () => {
    const { routineScope, stepScope } = routineAndStepScope(
      "routine-1",
      "1-abc",
    );
    const game = gameScope("501");

    const routineFetcher = vi
      .fn()
      .mockResolvedValueOnce(
        response(
          noneQuery.from,
          noneQuery.to,
          [bucket(noneQuery.from, noneQuery.to, true, 1)],
          "v1:1:100",
        ),
      )
      .mockResolvedValueOnce(
        response(
          noneQuery.from,
          noneQuery.to,
          [bucket(noneQuery.from, noneQuery.to, true, 1)],
          "v1:2:200",
        ),
      );
    const stepFetcher = vi
      .fn()
      .mockResolvedValueOnce(
        response(
          noneQuery.from,
          noneQuery.to,
          [bucket(noneQuery.from, noneQuery.to, true, 1)],
          "v1:1:100",
        ),
      )
      .mockResolvedValueOnce(
        response(
          noneQuery.from,
          noneQuery.to,
          [bucket(noneQuery.from, noneQuery.to, true, 1)],
          "v1:2:200",
        ),
      );
    const gameFetcher = vi
      .fn()
      .mockResolvedValue(
        response(
          noneQuery.from,
          noneQuery.to,
          [bucket(noneQuery.from, noneQuery.to, true, 1)],
          "g1:9:9",
        ),
      );

    await readSection(
      "p1",
      routineScope,
      routineVolumeMeta,
      noneQuery,
      routineFetcher,
    );
    await readSection("p1", stepScope, stepVolumeMeta, noneQuery, stepFetcher);
    await readSection("p1", game, SECTIONS.volume, noneQuery, gameFetcher);
    routineFetcher.mockClear();
    stepFetcher.mockClear();
    gameFetcher.mockClear();

    // A direct dataVersion note (e.g. Task 9's routine store recording a
    // freshly-fetched header token) needs no section fetch of its own to
    // invalidate every scope sharing its `versionKey`.
    await noteDataVersion("p1", routineScopeKey("routine-1"), "v1:2:200");

    await readSection(
      "p1",
      routineScope,
      routineVolumeMeta,
      noneQuery,
      routineFetcher,
    );
    await readSection("p1", stepScope, stepVolumeMeta, noneQuery, stepFetcher);
    await readSection("p1", game, SECTIONS.volume, noneQuery, gameFetcher);

    expect(routineFetcher).toHaveBeenCalledTimes(1);
    expect(stepFetcher).toHaveBeenCalledTimes(1);
    expect(gameFetcher).toHaveBeenCalledTimes(0);
  });
});

type StepResultLike = {
  metrics: Record<string, number>;
  headlineMin: number | null;
  headlineMax: number | null;
  sessions: number;
  skippedSessions: number;
};

describe("readSection (server, step-result chunk merge, controller ruling R22)", () => {
  beforeEach(() => deleteStatsDb());

  it("merges step-result chunks with the exercise kind's own spec, proving a `max` metric does not sum", async () => {
    const query = {
      bucket: "none" as const,
      context: "all" as const,
      inputMode: "VISUAL_BOARD",
      from: "2026-01-01T00:00:00.000Z",
      to: "2026-03-01T00:00:00.000Z",
    };
    const scope: CacheScope = {
      key: stepScopeKey("routine-1", "1-abc"),
      gameTypeKey: null,
      exerciseKind: "TARGET_SCORING",
    };
    const fetcher = vi
      .fn()
      .mockImplementation((span: { from: string; to: string }) =>
        Promise.resolve({
          sectionId: "step-result",
          sectionVersion: 1,
          dataVersion: "v1:1:0",
          bucket: "none" as const,
          tz: null,
          range: { from: span.from, to: span.to },
          buckets: [
            {
              start: span.from,
              end: span.to,
              closed: true,
              sampleSize: 1,
              metrics: (span.from === "2026-01-01T00:00:00.000Z"
                ? {
                    metrics: { bestChain: 10, darts: 9, hits: 3 },
                    headlineMin: 10,
                    headlineMax: 10,
                    sessions: 1,
                    skippedSessions: 0,
                  }
                : {
                    metrics: { bestChain: 15, darts: 3, hits: 1 },
                    headlineMin: 8,
                    headlineMax: 12,
                    sessions: 1,
                    skippedSessions: 1,
                  }) as StepResultLike,
            },
          ],
        }),
      );

    const result = await readSection(
      "p1",
      scope,
      ROUTINE_SECTIONS["step-result"],
      query,
      fetcher,
      new Date("2026-04-01T00:00:00.000Z"),
    );

    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(result.buckets).toHaveLength(1);
    // bestChain is TARGET_SCORING's own "max" metric (STEP_METRIC_SPECS): the
    // merge takes 15 (the larger chunk), never 25 (10 + 15) — proof the
    // merge reads its kind's spec rather than summing everything.
    expect(result.buckets[0]!.metrics).toEqual({
      metrics: { bestChain: 15, darts: 12, hits: 4 },
      headlineMin: 8,
      headlineMax: 12,
      sessions: 2,
      skippedSessions: 1,
    });
  });

  it("throws when a step-result chunk read has no exerciseKind (programming error)", async () => {
    const query = {
      bucket: "none" as const,
      context: "all" as const,
      inputMode: "VISUAL_BOARD",
      from: "2026-01-01T00:00:00.000Z",
      to: "2026-02-01T00:00:00.000Z",
    };
    const scope: CacheScope = {
      key: stepScopeKey("routine-1", "1-abc"),
      gameTypeKey: null,
    };
    const fetcher = vi.fn();

    await expect(
      readSection("p1", scope, ROUTINE_SECTIONS["step-result"], query, fetcher),
    ).rejects.toThrow();
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("throws the same contract check even when IndexedDB is unavailable (controller ruling R23 item 5)", async () => {
    const original = globalThis.indexedDB;
    // @ts-expect-error simulating an environment without IndexedDB
    delete globalThis.indexedDB;
    const query = {
      bucket: "none" as const,
      context: "all" as const,
      inputMode: "VISUAL_BOARD",
      from: "2026-01-01T00:00:00.000Z",
      to: "2026-02-01T00:00:00.000Z",
    };
    const scope: CacheScope = {
      key: stepScopeKey("routine-1", "1-abc"),
      gameTypeKey: null,
    };
    const fetcher = vi.fn();

    await expect(
      readSection("p1", scope, ROUTINE_SECTIONS["step-result"], query, fetcher),
    ).rejects.toThrow();
    expect(fetcher).not.toHaveBeenCalled();

    globalThis.indexedDB = original;
  });
});

describe("readSessionPage", () => {
  beforeEach(() => deleteStatsDb());

  it("caches a page and serves it while dataVersion is unchanged", async () => {
    const fetcher = vi.fn().mockResolvedValue({
      items: [{ id: "s1" }],
      nextCursor: null,
      dataVersion: "v1",
    });

    const first = await readSessionPage(
      "p1",
      gameScopeKey("501" as GameTypeKey),
      {
        bucket: "none",
        context: "all",
        inputMode: "VISUAL_BOARD",
        from: "a",
        to: "b",
      },
      fetcher,
    );
    const second = await readSessionPage(
      "p1",
      gameScopeKey("501" as GameTypeKey),
      {
        bucket: "none",
        context: "all",
        inputMode: "VISUAL_BOARD",
        from: "a",
        to: "b",
      },
      fetcher,
    );

    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(second).toEqual(first);
  });
});

type ReplayPageLike = { header: null; turns: unknown[]; nextCursor: null };

function replayPage(): ReplayPageLike {
  return { header: null, turns: [], nextCursor: null };
}

describe("readReplayPage", () => {
  beforeEach(() => deleteStatsDb());

  it("fetches on the first read", async () => {
    const fetcher = vi.fn().mockResolvedValue(replayPage());

    const result = await readReplayPage("s1", undefined, fetcher);

    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(result).toEqual(replayPage());
  });

  it("does not call the fetcher again for an identical read", async () => {
    const fetcher = vi.fn().mockResolvedValue(replayPage());
    await readReplayPage("s1", undefined, fetcher);
    fetcher.mockClear();

    const result = await readReplayPage("s1", undefined, fetcher);

    expect(fetcher).not.toHaveBeenCalled();
    expect(result).toEqual(replayPage());
  });

  it("misses the cache for a different cursor", async () => {
    const fetcher = vi.fn().mockResolvedValue(replayPage());
    await readReplayPage("s1", undefined, fetcher);
    fetcher.mockClear();

    await readReplayPage("s1", "v1:abc:2", fetcher);

    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("does not cache a fetcher rejection", async () => {
    const fetcher = vi
      .fn()
      .mockRejectedValueOnce(new Error("boom"))
      .mockResolvedValueOnce(replayPage());

    await expect(readReplayPage("s1", undefined, fetcher)).rejects.toThrow(
      "boom",
    );
    const result = await readReplayPage("s1", undefined, fetcher);

    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(result).toEqual(replayPage());
  });

  it("calls the fetcher every time when IndexedDB is unavailable", async () => {
    const original = globalThis.indexedDB;
    // @ts-expect-error simulating an environment without IndexedDB
    delete globalThis.indexedDB;
    const fetcher = vi.fn().mockResolvedValue(replayPage());

    await readReplayPage("s1", undefined, fetcher);
    const result = await readReplayPage("s1", undefined, fetcher);

    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(result).toEqual(replayPage());
    globalThis.indexedDB = original;
  });
});

describe("clearStatsCache", () => {
  beforeEach(() => deleteStatsDb());

  it("empties every store", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(
        response(baseQuery.from, baseQuery.to, [
          bucket("2026-01-01T00:00:00.000Z", "2026-02-01T00:00:00.000Z", true),
        ]),
      );
    await readSection("p1", gameScope("501"), meta, baseQuery, fetcher);

    await clearStatsCache();
    fetcher.mockClear();
    await readSection("p1", gameScope("501"), meta, baseQuery, fetcher);

    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher).toHaveBeenCalledWith({
      from: baseQuery.from,
      to: baseQuery.to,
    });
  });

  it("empties replayPages", async () => {
    const fetcher = vi.fn().mockResolvedValue(replayPage());
    await readReplayPage("s1", undefined, fetcher);

    await clearStatsCache();
    fetcher.mockClear();
    await readReplayPage("s1", undefined, fetcher);

    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});

describe("missingSpans", () => {
  it("returns the whole requested range when there is no coverage yet", () => {
    expect(missingSpans({ ...baseQuery }, undefined)).toEqual([
      { from: baseQuery.from, to: baseQuery.to },
    ]);
  });

  it("returns nothing when the requested range is already fully covered", () => {
    const coverage = {
      coveredFrom: baseQuery.from,
      coveredTo: baseQuery.to,
      dataVersion: "v1",
    };
    expect(missingSpans({ ...baseQuery }, coverage)).toEqual([]);
  });

  it("returns only the trailing span when the tail is still open", () => {
    const coverage = {
      coveredFrom: baseQuery.from,
      coveredTo: "2026-03-01T00:00:00.000Z",
      dataVersion: "v1",
    };
    expect(missingSpans({ ...baseQuery }, coverage)).toEqual([
      { from: "2026-03-01T00:00:00.000Z", to: baseQuery.to },
    ]);
  });

  it("returns only the leading span when widening from earlier", () => {
    const coverage = {
      coveredFrom: "2026-02-01T00:00:00.000Z",
      coveredTo: baseQuery.to,
      dataVersion: "v1",
    };
    expect(missingSpans({ ...baseQuery }, coverage)).toEqual([
      { from: baseQuery.from, to: "2026-02-01T00:00:00.000Z" },
    ]);
  });

  it("returns both spans when widening earlier while the tail is still open", () => {
    const coverage = {
      coveredFrom: "2026-02-01T00:00:00.000Z",
      coveredTo: "2026-03-01T00:00:00.000Z",
      dataVersion: "v1",
    };
    expect(missingSpans({ ...baseQuery }, coverage)).toEqual([
      { from: baseQuery.from, to: "2026-02-01T00:00:00.000Z" },
      { from: "2026-03-01T00:00:00.000Z", to: baseQuery.to },
    ]);
  });
});
