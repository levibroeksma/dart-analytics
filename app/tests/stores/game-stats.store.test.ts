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

describe("gameStatsStore", () => {
  it("loads 501's sections via the cache", async () => {
    const store = gameStatsStore();
    store.gameTypeKey = "501";

    await store.load();

    expect(readSection).toHaveBeenCalledTimes(4);
    const sectionIds = readSection.mock.calls.map((call) => call[2].id).sort();
    expect(sectionIds).toEqual([
      "completion",
      "heatmap",
      "session-result",
      "volume",
    ]);
  });

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
});
