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
});
