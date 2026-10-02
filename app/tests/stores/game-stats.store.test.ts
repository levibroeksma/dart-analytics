import { beforeEach, describe, expect, it, vi } from "vitest";

const readSection = vi.fn();
const readSessionPage = vi.fn();
const fetchGameSection = vi.fn();
const fetchGameSessions = vi.fn();

vi.mock("@client/stats-cache/cache", () => ({
  readSection: (...args: unknown[]) => readSection(...args),
  readSessionPage: (...args: unknown[]) => readSessionPage(...args),
}));
vi.mock("@client/api/statistics", () => ({
  fetchGameSection: (...args: unknown[]) => fetchGameSection(...args),
  fetchGameSessions: (...args: unknown[]) => fetchGameSessions(...args),
}));

const { gameStatsStore } = await import("@stores/game-stats.store");

function series(metrics: unknown, sampleSize = 1) {
  return {
    sectionId: "completion",
    sectionVersion: 1,
    dataVersion: "v1:1:0",
    bucket: "month",
    tz: "Europe/Amsterdam",
    range: { from: "2026-01-01T00:00:00.000Z", to: "2026-02-01T00:00:00.000Z" },
    buckets: [
      {
        start: "2026-01-01T00:00:00.000Z",
        end: "2026-02-01T00:00:00.000Z",
        closed: true,
        sampleSize,
        metrics,
      },
    ],
  };
}

beforeEach(() => {
  readSection.mockReset();
  readSessionPage.mockReset();
  fetchGameSection.mockReset();
  fetchGameSessions.mockReset();
  readSection.mockResolvedValue(
    series(
      { completed: 0, abandoned: 0, neverStarted: 0, abandonedTurns: 0 },
      0,
    ),
  );
  readSessionPage.mockResolvedValue({
    items: [],
    nextCursor: null,
    dataVersion: "v1",
  });
});

function trendMetrics(
  points: number,
  darts: number,
  firstNinePoints = 0,
  firstNineDarts = 0,
) {
  return {
    points,
    darts,
    firstNinePoints,
    firstNineDarts,
    bands: { ton: 0, tonForty: 0, oneEighty: 0 },
  };
}

function trendSeries(buckets: { start: string; metrics: unknown }[]) {
  return {
    ...series({}, 1),
    buckets: buckets.map((b) => ({
      start: b.start,
      end: b.start,
      closed: true,
      sampleSize: 1,
      metrics: b.metrics,
    })),
  };
}

async function loadTrend(buckets: { start: string; metrics: unknown }[]) {
  readSection.mockImplementation((_player, _game, meta) =>
    Promise.resolve(
      meta.id === "scoring-trend" ? trendSeries(buckets) : series({}, 0),
    ),
  );
  const store = gameStatsStore();
  store.gameTypeKey = "501";
  await store.load();
  return store;
}

describe("gameStatsStore", () => {
  it("exposes targetLabel for statistics cards", () => {
    const store = gameStatsStore();

    expect(store.targetLabel("TREBLE:20")).toBe("T20");
    expect(store.targetLabel("DOUBLE:16")).toBe("D16");
  });

  it("loads 501's sections via the cache", async () => {
    const store = gameStatsStore();
    store.gameTypeKey = "501";

    await store.load();

    // 11 sections for 501 (`section-registry.ts`): the checkout family
    // (scoring-trend, checkout-rate, double-performance, checkout-path,
    // bust-rate, leg-stats, treble-rate) plus phase 1's heatmap,
    // session-result, completion and volume. `checkout-path` is fetched
    // through its own dedicated `readSection` call (not bucketable), so the
    // count is still 11, not 10.
    expect(readSection).toHaveBeenCalledTimes(11);
    const sectionIds = readSection.mock.calls.map((call) => call[2].id).sort();
    expect(sectionIds).toEqual([
      "bust-rate",
      "checkout-path",
      "checkout-rate",
      "completion",
      "double-performance",
      "heatmap",
      "leg-stats",
      "scoring-trend",
      "session-result",
      "treble-rate",
      "volume",
    ]);
    // Controller ruling R4: every call passes a `{ key, gameTypeKey }` scope,
    // not the bare `gameTypeKey` string phase 1 used.
    for (const call of readSection.mock.calls) {
      expect(call[1]).toEqual({ key: "game:501", gameTypeKey: "501" });
    }
    expect(readSessionPage).toHaveBeenCalledWith(
      "me",
      "game:501",
      expect.anything(),
      expect.anything(),
    );
  });

  it("init() fetches nothing; statistics load only on selectGame/load", async () => {
    const store = gameStatsStore();

    store.init();

    expect(readSection).not.toHaveBeenCalled();
    expect(readSessionPage).not.toHaveBeenCalled();
  });

  it("one failing section keeps the other sections and the session list", async () => {
    readSection.mockImplementation((_player, _game, meta) =>
      meta.id === "volume"
        ? Promise.reject(new Error("over cap"))
        : Promise.resolve(series({}, 0)),
    );
    readSessionPage.mockResolvedValue({
      items: [{ sessionId: "s1" }],
      nextCursor: null,
      dataVersion: "v1",
    });
    const store = gameStatsStore();
    store.gameTypeKey = "501";

    await store.load();

    expect(store.sections.completion).toBeDefined();
    expect(store.sections.volume).toBeUndefined();
    expect(store.sessions).toHaveLength(1);
    expect(store.sectionErrors.volume).toBe("over cap");
    expect(store.failedSectionsMessage).toBe("Could not load: volume");
    expect(store.error).toBeNull();
    expect(store.loading).toBe(false);
  });

  it("a failing session list sets error without dropping the sections", async () => {
    readSessionPage.mockRejectedValue(new Error("sessions down"));
    const store = gameStatsStore();
    store.gameTypeKey = "501";

    await store.load();

    expect(store.sections.completion).toBeDefined();
    expect(store.error).toBe("sessions down");
    expect(store.failedSectionsMessage).toBeNull();
  });

  it.each(["501", "SINGLES_TRAINING"] as const)(
    "%s: every non-bucketable section reads and fetches un-bucketed, every bucketable one by month",
    async (gameTypeKey) => {
      const store = gameStatsStore();
      store.gameTypeKey = gameTypeKey;

      await store.load();
      await store.loadHeatmap();

      const span = {
        from: "2026-01-01T00:00:00.000Z",
        to: "2026-02-01T00:00:00.000Z",
      };
      for (const [, , meta, query, fetcher] of readSection.mock.calls) {
        fetchGameSection.mockClear();
        await fetcher(span);
        const params = fetchGameSection.mock.calls[0][2];
        if (meta.bucketable) {
          expect(query.bucket, meta.id).toBe("month");
          expect(params.bucket, meta.id).toBe("month");
        } else {
          expect(query.bucket, meta.id).toBe("none");
          expect(query.tz, meta.id).toBeUndefined();
          expect(params.bucket, meta.id).toBe("none");
          expect(params.tz, meta.id).toBeUndefined();
        }
      }
      const ids = readSection.mock.calls.map((call) => call[2].id);
      expect(ids).toContain("heatmap");
    },
  );

  it("selectGame(SINGLES_V1) resolves to SINGLES_TRAINING", async () => {
    const store = gameStatsStore();

    store.selectGame("SINGLES_V1");
    await Promise.resolve();

    expect(store.gameTypeKey).toBe("SINGLES_TRAINING");
  });

  it("abandon rate is null when sampleSize is 0", async () => {
    const store = gameStatsStore();
    await store.load();

    expect(store.abandonRate).toBeNull();
  });

  it("abandon rate reflects abandoned + neverStarted over the sample", async () => {
    readSection.mockImplementation((_player, _game, meta) => {
      if (meta.id === "completion") {
        return Promise.resolve(
          series(
            { completed: 6, abandoned: 3, neverStarted: 1, abandonedTurns: 9 },
            10,
          ),
        );
      }
      return Promise.resolve(series({}, 0));
    });

    const store = gameStatsStore();
    await store.load();

    expect(store.abandonRate).toBe(0.4);
  });

  it("loadMoreSessions appends and stops at nextCursor: null", async () => {
    const store = gameStatsStore();
    readSessionPage.mockResolvedValueOnce({
      items: [{ sessionId: "s1" }],
      nextCursor: "cursor-2",
      dataVersion: "v1",
    });
    await store.load();
    expect(store.sessions).toHaveLength(1);
    expect(store.nextCursor).toBe("cursor-2");

    readSessionPage.mockResolvedValueOnce({
      items: [{ sessionId: "s2" }],
      nextCursor: null,
      dataVersion: "v1",
    });
    await store.loadMoreSessions();

    expect(
      store.sessions.map((s: { sessionId: string }) => s.sessionId),
    ).toEqual(["s1", "s2"]);
    expect(store.nextCursor).toBeNull();

    await store.loadMoreSessions();
    expect(readSessionPage).toHaveBeenCalledTimes(2);
  });

  it("favoriteTarget ignores targets under the minimum sample", async () => {
    readSection.mockImplementation((_player, _game, meta) => {
      if (meta.id === "target-accuracy") {
        return Promise.resolve(
          series(
            {
              "DOUBLE:16": { attempts: 29, hits: 29 },
              "DOUBLE:8": { attempts: 30, hits: 15 },
            },
            59,
          ),
        );
      }
      return Promise.resolve(series({}, 0));
    });

    const store = gameStatsStore();
    store.gameTypeKey = "DOUBLES_TRAINING";
    await store.load();

    expect(store.favoriteTarget?.targetKey).toBe("DOUBLE:8");
  });

  it("weakestTarget picks the lowest qualifying rate", async () => {
    readSection.mockImplementation((_player, _game, meta) => {
      if (meta.id === "target-accuracy") {
        return Promise.resolve(
          series(
            {
              "DOUBLE:16": { attempts: 30, hits: 10 },
              "DOUBLE:8": { attempts: 30, hits: 20 },
            },
            60,
          ),
        );
      }
      return Promise.resolve(series({}, 0));
    });

    const store = gameStatsStore();
    store.gameTypeKey = "DOUBLES_TRAINING";
    await store.load();

    expect(store.weakestTarget?.targetKey).toBe("DOUBLE:16");
  });

  it("changing heatmapTarget calls readSection for heatmap only", async () => {
    const store = gameStatsStore();
    store.gameTypeKey = "DOUBLES_TRAINING";
    readSection.mockClear();

    await store.selectHeatmapTarget("DOUBLE:16");

    expect(readSection).toHaveBeenCalledTimes(1);
    expect(readSection.mock.calls[0][2].id).toBe("heatmap");
    expect(store.heatmapTarget).toBe("DOUBLE:16");
  });

  it("passes the heatmap target in the cache query and the section fetch", async () => {
    const store = gameStatsStore();
    store.gameTypeKey = "DOUBLES_TRAINING";
    readSection.mockClear();

    await store.selectHeatmapTarget("DOUBLE:16");

    const [, , , query, fetcher] = readSection.mock.calls[0];
    expect(query).toMatchObject({
      target: "DOUBLE:16",
      context: "all",
      inputMode: "VISUAL_BOARD",
    });
    fetcher({ from: query.from, to: query.to });
    expect(fetchGameSection).toHaveBeenCalledWith(
      "DOUBLES_TRAINING",
      "heatmap",
      expect.objectContaining({ target: "DOUBLE:16" }),
    );
  });

  it("missRose returns 8 entries", async () => {
    const store = gameStatsStore();
    expect(store.missRose("DOUBLE:16")).toHaveLength(8);
  });

  it("confusionTop sorts non-hit landings by count, excluding the target itself", async () => {
    readSection.mockImplementation((_player, _game, meta) => {
      if (meta.id === "confusion") {
        return Promise.resolve(
          series(
            {
              "DOUBLE:16": { "DOUBLE:16": 5, "DOUBLE:8": 3, MISS: 1 },
            },
            9,
          ),
        );
      }
      return Promise.resolve(series({}, 0));
    });

    const store = gameStatsStore();
    store.gameTypeKey = "DOUBLES_TRAINING";
    await store.load();

    expect(store.confusionTop("DOUBLE:16", 2)).toEqual([
      { hitKey: "DOUBLE:8", count: 3 },
      { hitKey: "MISS", count: 1 },
    ]);
  });

  it("groupingRows summarizes the summed moment per target", async () => {
    readSection.mockImplementation((_player, _game, meta) => {
      if (meta.id === "grouping") {
        return Promise.resolve(
          series(
            {
              "DOUBLE:16": {
                n: 4,
                sumX: 0,
                sumY: 0,
                sumXX: 8,
                sumYY: 8,
                sumXY: 0,
              },
            },
            4,
          ),
        );
      }
      return Promise.resolve(series({}, 0));
    });

    const store = gameStatsStore();
    store.gameTypeKey = "DOUBLES_TRAINING";
    await store.load();

    const row = store.groupingRows.find(
      (r: { targetKey: string }) => r.targetKey === "DOUBLE:16",
    )!;
    expect(row.summary!.n).toBe(4);
  });

  it("heatmapCells positions cells as board percentages, opacity scaled to the busiest cell", async () => {
    readSection.mockImplementation((_player, _game, meta) => {
      if (meta.id === "heatmap") {
        return Promise.resolve({
          sectionId: "heatmap",
          sectionVersion: 1,
          dataVersion: "v1:1:0",
          bucket: "none",
          tz: null,
          range: {
            from: "2026-01-01T00:00:00.000Z",
            to: "2026-02-01T00:00:00.000Z",
          },
          buckets: [
            {
              start: "2026-01-01T00:00:00.000Z",
              end: "2026-02-01T00:00:00.000Z",
              closed: true,
              sampleSize: 16,
              metrics: {
                cellMm: 5,
                target: null,
                cells: [
                  [0, 0, 12],
                  [1, -1, 4],
                ],
              },
            },
          ],
        });
      }
      return Promise.resolve(series({}, 0));
    });

    const store = gameStatsStore();
    store.gameTypeKey = "DOUBLES_TRAINING";
    await store.load();

    expect(store.heatmapCells).toHaveLength(2);
    const origin = store.heatmapCells.find(
      (c: { key: string }) => c.key === "0:0",
    )!;
    expect(origin.leftPct).toBeCloseTo(50);
    expect(origin.topPct).toBeCloseTo(50);
    expect(origin.opacity).toBe(1);
    const other = store.heatmapCells.find(
      (c: { key: string }) => c.key === "1:-1",
    )!;
    expect(other.opacity).toBeCloseTo(4 / 12);
  });

  it("looseDartsTrend sums on/near/loose per bucket across targets", async () => {
    readSection.mockImplementation((_player, _game, meta) => {
      if (meta.id === "loose-darts") {
        return Promise.resolve(
          series(
            {
              "DOUBLE:16": { onTarget: 3, nearMiss: 2, loose: 1 },
              "DOUBLE:8": { onTarget: 1, nearMiss: 1, loose: 1 },
            },
            9,
          ),
        );
      }
      return Promise.resolve(series({}, 0));
    });

    const store = gameStatsStore();
    store.gameTypeKey = "DOUBLES_TRAINING";
    await store.load();

    expect(store.looseDartsTrend).toEqual([
      {
        start: "2026-01-01T00:00:00.000Z",
        onTarget: 4,
        nearMiss: 3,
        loose: 2,
      },
    ]);
  });

  it("checkoutRateBands sums chances/finished into REMAINING_BANDS, gating rate below MIN_TARGET_SAMPLE", async () => {
    readSection.mockImplementation((_player, _game, meta) => {
      if (meta.id === "checkout-rate") {
        return Promise.resolve(
          series(
            {
              "35": { chances: 20, finished: 10 },
              "38": { chances: 15, finished: 5 },
              "45": { chances: 5, finished: 5 },
            },
            40,
          ),
        );
      }
      return Promise.resolve(series({}, 0));
    });

    const store = gameStatsStore();
    store.gameTypeKey = "501";
    await store.load();

    const lowBand = store.checkoutRateBands.find(
      (b: { label: string }) => b.label === "2–40",
    )!;
    expect(lowBand.chances).toBe(35);
    expect(lowBand.finished).toBe(15);
    expect(lowBand.rate).toBeCloseTo(15 / 35);

    const nextBand = store.checkoutRateBands.find(
      (b: { label: string }) => b.label === "41–60",
    )!;
    expect(nextBand.chances).toBe(5);
    expect(nextBand.rate).toBeNull();
  });

  it("bustRateBands sums visits/busts into REMAINING_BANDS, gating rate below MIN_TARGET_SAMPLE", async () => {
    readSection.mockImplementation((_player, _game, meta) => {
      if (meta.id === "bust-rate") {
        return Promise.resolve(series({ "40": { visits: 32, busts: 8 } }, 32));
      }
      return Promise.resolve(series({}, 0));
    });

    const store = gameStatsStore();
    store.gameTypeKey = "501";
    await store.load();

    const band = store.bustRateBands.find(
      (b: { label: string }) => b.label === "2–40",
    )!;
    expect(band.visits).toBe(32);
    expect(band.busts).toBe(8);
    expect(band.rate).toBeCloseTo(8 / 32);
  });

  it("checkoutRateTrend/bustRateTrend/trebleRateTrend give one gated rate per bucket", async () => {
    readSection.mockImplementation((_player, _game, meta) => {
      if (meta.id === "checkout-rate") {
        return Promise.resolve(
          series({ "170": { chances: 32, finished: 16 } }, 32),
        );
      }
      if (meta.id === "bust-rate") {
        return Promise.resolve(series({ "40": { visits: 5, busts: 1 } }, 5));
      }
      if (meta.id === "treble-rate") {
        return Promise.resolve(
          series({ "20": { darts: 40, trebles: 20 } }, 40),
        );
      }
      return Promise.resolve(series({}, 0));
    });

    const store = gameStatsStore();
    store.gameTypeKey = "501";
    await store.load();

    expect(store.checkoutRateTrend).toEqual([
      { start: "2026-01-01T00:00:00.000Z", rate: 0.5 },
    ]);
    expect(store.bustRateTrend).toEqual([
      { start: "2026-01-01T00:00:00.000Z", rate: null },
    ]);
    expect(store.trebleRateTrend).toEqual([
      { start: "2026-01-01T00:00:00.000Z", rate: 0.5 },
    ]);
  });

  it("favoriteDouble/weakestDouble ignore doubles under the minimum sample", async () => {
    readSection.mockImplementation((_player, _game, meta) => {
      if (meta.id === "double-performance") {
        return Promise.resolve(
          series(
            {
              "DOUBLE:16": { attempts: 29, hits: 29 },
              "DOUBLE:8": { attempts: 30, hits: 15 },
              "INNER_BULL:25": { attempts: 30, hits: 3 },
            },
            89,
          ),
        );
      }
      return Promise.resolve(series({}, 0));
    });

    const store = gameStatsStore();
    store.gameTypeKey = "501";
    await store.load();

    expect(store.favoriteDouble?.targetKey).toBe("DOUBLE:8");
    expect(store.weakestDouble?.targetKey).toBe("INNER_BULL:25");
  });

  it("pathsFor sorts routes by visits and chartRouteFor gives the conventional route", async () => {
    readSection.mockImplementation((_player, _game, meta) => {
      if (meta.id === "checkout-path") {
        return Promise.resolve({
          sectionId: "checkout-path",
          sectionVersion: 1,
          dataVersion: "v1:1:0",
          bucket: "none",
          tz: null,
          range: {
            from: "2026-01-01T00:00:00.000Z",
            to: "2026-02-01T00:00:00.000Z",
          },
          buckets: [
            {
              start: "2026-01-01T00:00:00.000Z",
              end: "2026-02-01T00:00:00.000Z",
              closed: true,
              sampleSize: 3,
              metrics: {
                "170": {
                  "T20 T20 BULL": { visits: 1, finished: 1 },
                  "T20 T19 D8": { visits: 2, finished: 0 },
                },
              },
            },
          ],
        });
      }
      return Promise.resolve(series({}, 0));
    });

    const store = gameStatsStore();
    store.gameTypeKey = "501";
    await store.load();

    expect(store.pathsFor(170)).toEqual([
      { route: "T20 T19 D8", visits: 2, finished: 0, finishRate: 0 },
      { route: "T20 T20 BULL", visits: 1, finished: 1, finishRate: 1 },
    ]);
    expect(store.chartRouteFor(170)).toEqual(["T20", "T20", "BULL"]);
    expect(store.chartRouteFor(169)).toBeNull();
  });

  it("ladderSummary bands attempts by ten, tracks maxTarget and gates recoveryRate", async () => {
    readSection.mockImplementation((_player, _game, meta) => {
      if (meta.id === "ladder-progress") {
        return Promise.resolve(
          series(
            {
              targets: {
                "41": { attempts: 20, successes: 10 },
                "45": { attempts: 10, successes: 5 },
              },
              maxTarget: 51,
              afterMiss: 5,
              recovered: 2,
            },
            30,
          ),
        );
      }
      return Promise.resolve(series({}, 0));
    });

    const store = gameStatsStore();
    store.gameTypeKey = "ONE_TWENTY_ONE";
    await store.load();

    const summary = store.ladderSummary!;
    expect(summary.maxTarget).toBe(51);
    expect(summary.recoveryRate).toBeNull();
    const band = summary.bands.find((b: { start: number }) => b.start === 41)!;
    expect(band.attempts).toBe(30);
    expect(band.successes).toBe(15);
    expect(band.rate).toBeCloseTo(0.5);
  });

  it("ladderSummary merges maxTarget across buckets and gives a non-null recoveryRate", async () => {
    readSection.mockImplementation((_player, _game, meta) => {
      if (meta.id === "ladder-progress") {
        return Promise.resolve({
          sectionId: "ladder-progress",
          sectionVersion: 1,
          dataVersion: "v1:1:0",
          bucket: "month",
          tz: "Europe/Amsterdam",
          range: {
            from: "2026-01-01T00:00:00.000Z",
            to: "2026-03-01T00:00:00.000Z",
          },
          buckets: [
            {
              start: "2026-01-01T00:00:00.000Z",
              end: "2026-02-01T00:00:00.000Z",
              closed: true,
              sampleSize: 10,
              metrics: {
                targets: { "41": { attempts: 10, successes: 5 } },
                maxTarget: null,
                afterMiss: 20,
                recovered: 5,
              },
            },
            {
              start: "2026-02-01T00:00:00.000Z",
              end: "2026-03-01T00:00:00.000Z",
              closed: true,
              sampleSize: 10,
              metrics: {
                targets: { "41": { attempts: 10, successes: 5 } },
                maxTarget: 41,
                afterMiss: 20,
                recovered: 10,
              },
            },
          ],
        });
      }
      return Promise.resolve(series({}, 0));
    });

    const store = gameStatsStore();
    store.gameTypeKey = "ONE_TWENTY_ONE";
    await store.load();

    const summary = store.ladderSummary!;
    expect(summary.maxTarget).toBe(41);
    expect(summary.recoveryRate).toBeCloseTo(15 / 40);
  });

  it("legHistogram/bestLeg/averageLegDarts derive from the darts-per-leg counts", async () => {
    readSection.mockImplementation((_player, _game, meta) => {
      if (meta.id === "leg-stats") {
        return Promise.resolve(series({ "21": 2, "18": 1 }, 3));
      }
      return Promise.resolve(series({}, 0));
    });

    const store = gameStatsStore();
    store.gameTypeKey = "501";
    await store.load();

    expect(store.legHistogram).toEqual([
      { darts: 18, legs: 1 },
      { darts: 21, legs: 2 },
    ]);
    expect(store.bestLeg).toBe(18);
    expect(store.averageLegDarts).toBeCloseTo((18 * 1 + 21 * 2) / 3);
  });

  it("threeDartAverage/firstNineAverage/bandCounts total scoring-trend across buckets", async () => {
    readSection.mockImplementation((_player, _game, meta) => {
      if (meta.id === "scoring-trend") {
        return Promise.resolve(
          series(
            {
              points: 300,
              darts: 60,
              firstNinePoints: 150,
              firstNineDarts: 27,
              bands: { ton: 3, tonForty: 1, oneEighty: 0 },
            },
            20,
          ),
        );
      }
      return Promise.resolve(series({}, 0));
    });

    const store = gameStatsStore();
    store.gameTypeKey = "501";
    await store.load();

    expect(store.threeDartAverage).toBeCloseTo((300 / 60) * 3);
    expect(store.firstNineAverage).toBeCloseTo((150 / 27) * 3);
    expect(store.bandCounts).toEqual({ ton: 3, tonForty: 1, oneEighty: 0 });
  });

  it("ringSplit reads TREBLE:20's count off confusion's single bucket", async () => {
    readSection.mockImplementation((_player, _game, meta) => {
      if (meta.id === "confusion") {
        return Promise.resolve(
          series(
            {
              "NUMBER:20": {
                "TREBLE:20": 7,
                "INNER_SINGLE:20": 2,
                "OUTER_SINGLE:20": 1,
                "DOUBLE:20": 3,
                MISS: 1,
              },
            },
            14,
          ),
        );
      }
      return Promise.resolve(series({}, 0));
    });

    const store = gameStatsStore();
    store.gameTypeKey = "SHANGHAI";
    await store.load();

    const rings = store.ringSplit("NUMBER:20");
    expect(rings).toContainEqual({ ring: "TREBLE", count: 7 });
    expect(rings).toContainEqual({ ring: "INNER_SINGLE", count: 2 });
    expect(rings).toContainEqual({ ring: "OUTER_SINGLE", count: 1 });
    expect(rings).toContainEqual({ ring: "DOUBLE", count: 3 });
  });

  it("ringSplit is empty for a non-NUMBER aim", async () => {
    const store = gameStatsStore();
    expect(store.ringSplit("DOUBLE:16")).toEqual([]);
  });

  it("slowestTargets sorts by darts/cleared descending, ignoring targets never cleared", async () => {
    readSection.mockImplementation((_player, _game, meta) => {
      if (meta.id === "atc-darts-per-target") {
        return Promise.resolve(
          series(
            {
              "AROUND_THE_CLOCK_V1|difficulty=|segment_rule=": {
                "NUMBER:1": { darts: 5, cleared: 0 },
                "NUMBER:2": { darts: 10, cleared: 2 },
                "NUMBER:3": { darts: 12, cleared: 4 },
              },
            },
            17,
          ),
        );
      }
      return Promise.resolve(series({}, 0));
    });

    const store = gameStatsStore();
    store.gameTypeKey = "AROUND_THE_CLOCK";
    await store.load();

    const slowest = store.slowestTargets(
      "AROUND_THE_CLOCK_V1|difficulty=|segment_rule=",
      3,
    );
    expect(slowest).toEqual([
      { targetKey: "NUMBER:2", darts: 10, cleared: 2, dartsPerTarget: 5 },
      { targetKey: "NUMBER:3", darts: 12, cleared: 4, dartsPerTarget: 3 },
    ]);
  });

  it("bobs27-survival merge test bridge: survivalCurve reads reached along doublesPath order and averages scoreAfter", async () => {
    readSection.mockImplementation((_player, _game, meta) => {
      if (meta.id === "bobs27-survival") {
        return Promise.resolve(
          series(
            {
              "BOBS27_V1|start_score=27|miss_penalty_multiplier=1|bull_hit_value=27":
                {
                  runs: 2,
                  completed: 1,
                  reached: { "DOUBLE:1": 2, "DOUBLE:2": 1 },
                  died: { "DOUBLE:2": 1 },
                  scoreAfter: {
                    "DOUBLE:1": { runs: 2, sum: 40, min: 15, max: 25 },
                  },
                },
            },
            2,
          ),
        );
      }
      return Promise.resolve(series({}, 0));
    });

    const store = gameStatsStore();
    store.gameTypeKey = "BOBS27";
    await store.load();

    const curve = store.survivalCurve(
      "BOBS27_V1|start_score=27|miss_penalty_multiplier=1|bull_hit_value=27",
    );
    expect(curve[0]).toEqual({
      targetKey: "DOUBLE:1",
      reached: 2,
      averageScore: 20,
    });
    expect(curve[1]).toEqual({
      targetKey: "DOUBLE:2",
      reached: 1,
      averageScore: null,
    });
    expect(curve.at(-1)!.targetKey).toBe("INNER_BULL:25");
  });

  it("shanghaiRateTrend gates below MIN_TARGET_SAMPLE and shanghaiByRound sums the round histogram", async () => {
    readSection.mockImplementation((_player, _game, meta) => {
      if (meta.id === "shanghai-count") {
        return Promise.resolve(
          series(
            { sessions: 40, shanghais: 4, byRound: { "3": 3, "7": 1 } },
            40,
          ),
        );
      }
      return Promise.resolve(series({}, 0));
    });

    const store = gameStatsStore();
    store.gameTypeKey = "SHANGHAI";
    await store.load();

    expect(store.shanghaiRateTrend).toEqual([
      { start: "2026-01-01T00:00:00.000Z", rate: 0.1 },
    ]);
    expect(store.shanghaiByRound).toEqual([
      { round: 3, count: 3 },
      { round: 7, count: 1 },
    ]);
  });

  it("pointsPerRound reads session-result's countedScoreSum/turnSum across rulesets", async () => {
    readSection.mockImplementation((_player, _game, meta) => {
      if (meta.id === "session-result") {
        return Promise.resolve(
          series(
            {
              SHANGHAI_V2: {
                sessions: 2,
                countedScoreSum: 300,
                dartSum: 120,
                turnSum: 40,
                countedScoreMin: 100,
                countedScoreMax: 200,
                bestLowSessionId: "11111111-1111-1111-1111-111111111111",
                bestHighSessionId: "22222222-2222-2222-2222-222222222222",
              },
            },
            2,
          ),
        );
      }
      return Promise.resolve(series({}, 0));
    });

    const store = gameStatsStore();
    store.gameTypeKey = "SHANGHAI";
    await store.load();

    expect(store.pointsPerRound).toBeCloseTo(300 / 40);
  });

  it("links a session and the session-result PB to their replay pages", async () => {
    readSection.mockImplementation((_player, _game, meta) => {
      if (meta.id === "session-result") {
        return Promise.resolve(
          series(
            {
              SHANGHAI_V2: {
                sessions: 2,
                countedScoreSum: 300,
                dartSum: 120,
                turnSum: 40,
                countedScoreMin: 100,
                countedScoreMax: 200,
                bestLowSessionId: "11111111-1111-1111-1111-111111111111",
                bestHighSessionId: "22222222-2222-2222-2222-222222222222",
              },
            },
            2,
          ),
        );
      }
      return Promise.resolve(series({}, 0));
    });

    const store = gameStatsStore();
    store.gameTypeKey = "SHANGHAI";
    await store.load();

    expect(store.replayHref("a b")).toBe("/statistics/replay?session=a%20b");
    const best = store.sessionResultRows[0]!.personalBest!;
    expect(store.replayHref(best.sessionId)).toBe(
      "/statistics/replay?session=22222222-2222-2222-2222-222222222222",
    );
  });

  it("skippedSessionsFor reads a server section's skippedSessions, 0 before load", async () => {
    const store = gameStatsStore();
    expect(store.skippedSessionsFor("shanghai-count")).toBe(0);

    readSection.mockImplementation((_player, _game, meta) => {
      if (meta.id === "shanghai-count") {
        return Promise.resolve({
          ...series({ sessions: 1, shanghais: 0, byRound: {} }, 1),
          skippedSessions: 3,
        });
      }
      return Promise.resolve(series({}, 0));
    });
    store.gameTypeKey = "SHANGHAI";
    await store.load();

    expect(store.skippedSessionsFor("shanghai-count")).toBe(3);
  });

  it("trebleRate gates below MIN_TARGET_SAMPLE and trebleRateAll sums every hit number", async () => {
    readSection.mockImplementation((_player, _game, meta) => {
      if (meta.id === "treble-rate") {
        return Promise.resolve(
          series(
            {
              "20": { darts: 40, trebles: 10 },
              "19": { darts: 10, trebles: 2 },
              MISS: { darts: 5, trebles: 0 },
            },
            55,
          ),
        );
      }
      return Promise.resolve(series({}, 0));
    });

    const store = gameStatsStore();
    store.gameTypeKey = "501";
    await store.load();

    expect(store.trebleRate("20")).toBeCloseTo(10 / 40);
    expect(store.trebleRate("19")).toBeNull();
    expect(store.trebleRateAll).toBeCloseTo(12 / 55);
  });

  describe("scoringTrendChart", () => {
    const jan = "2026-01-15T12:00:00.000Z";
    const feb = "2026-02-15T12:00:00.000Z";
    const monthLabel = (start: string) =>
      new Date(start).toLocaleDateString(undefined, {
        month: "short",
        year: "numeric",
      });

    it("charts the 3-dart and first-nine averages per month", async () => {
      const store = await loadTrend([
        { start: jan, metrics: trendMetrics(300, 30, 180, 18) },
        { start: feb, metrics: trendMetrics(360, 30, 0, 0) },
      ]);

      expect(store.scoringTrendChart).toEqual({
        kind: "line",
        labels: [monthLabel(jan), monthLabel(feb)],
        series: [
          {
            key: "three-dart-average",
            label: "3-dart average",
            data: [30, 36],
            color: "sky",
          },
          {
            key: "first-nine-average",
            label: "First nine",
            data: [30, null],
            color: "orange",
          },
        ],
        ariaLabel: "3-dart average per month",
      });
    });

    it("omits first nine when no bucket has first-nine darts", async () => {
      const store = await loadTrend([
        { start: jan, metrics: trendMetrics(300, 30) },
      ]);

      expect(
        store.scoringTrendChart.series.map((s: { key: string }) => s.key),
      ).toEqual(["three-dart-average"]);
    });

    it("leaves a gap, not zero, for a bucket with no darts", async () => {
      const store = await loadTrend([
        { start: jan, metrics: trendMetrics(0, 0) },
      ]);

      expect(store.scoringTrendChart.series[0].data).toEqual([null]);
    });

    it("is an empty line chart before the section has loaded", () => {
      const store = gameStatsStore();

      expect(store.scoringTrendChart).toEqual({
        kind: "line",
        labels: [],
        series: [
          {
            key: "three-dart-average",
            label: "3-dart average",
            data: [],
            color: "sky",
          },
        ],
        ariaLabel: "3-dart average per month",
      });
    });

    it("returns a fresh plain object on every read", async () => {
      const store = await loadTrend([
        { start: jan, metrics: trendMetrics(300, 30) },
      ]);

      const first = store.scoringTrendChart;
      expect(store.scoringTrendChart).not.toBe(first);
      expect(JSON.parse(JSON.stringify(first))).toEqual(first);
    });
  });
});
