import { beforeEach, describe, expect, it, vi } from "vitest";

const readSessionPage = vi.fn();
const fetchGameSessions = vi.fn();

vi.mock("@client/stats-cache/cache", () => ({
  readSessionPage: (...args: unknown[]) => readSessionPage(...args),
}));
vi.mock("@client/api/statistics", () => ({
  fetchGameSessions: (...args: unknown[]) => fetchGameSessions(...args),
}));

const { gameSessionList } =
  await import("@lib/stats/sections/game-session-list.data");

import { gameScopeKey } from "@modules/stats/routine-scope.module";

const NOW = new Date("2026-10-01T10:00:00.000Z");
const DAY = 86_400_000;

function item(id: string) {
  return {
    sessionId: id,
    rulesetVersionKey: "SCORE_TRAINING_V1",
    statusKey: "COMPLETED",
    contextKey: "STANDALONE",
    neverStarted: false,
    startedAt: "2026-10-01T09:00:00.000Z",
    completedAt: "2026-10-01T09:30:00.000Z",
    durationSeconds: 600,
    turnCount: 10,
    dartCount: 30,
    countedScore: 90,
  };
}

function page(ids: string[], nextCursor: string | null, totalCount?: number) {
  return { items: ids.map(item), nextCursor, totalCount, dataVersion: "v1" };
}

function section(game = "SCORE_TRAINING_V1") {
  const watchers: Record<string, () => void> = {};
  const data = { rangeKey: "30d" as "30d" | "90d" | "1y" | "all", game };
  const own = gameSessionList();
  const s = Object.assign(own, {
    $data: data,
    $watch: (key: "rangeKey" | "game", cb: () => void) => {
      watchers[key] = cb;
    },
  });
  return { s, watchers, data };
}

beforeEach(() => {
  readSessionPage.mockReset();
  fetchGameSessions.mockReset();
  readSessionPage.mockImplementation(
    (_p: string, _s: string, _q: unknown, fetcher: () => unknown) => fetcher(),
  );
  fetchGameSessions.mockResolvedValue(page([], null));
});

describe("gameSessionList", () => {
  it("fetches the first page over the current period", async () => {
    fetchGameSessions.mockResolvedValue(page(["a", "b"], "next"));
    const { s } = section();
    await s.load(NOW);
    expect(fetchGameSessions).toHaveBeenCalledWith("SCORE_TRAINING", {
      from: new Date(NOW.getTime() - 30 * DAY).toISOString(),
      to: new Date(NOW.getTime() + 60_000).toISOString(),
      status: "completed",
      limit: 10,
    });
    expect(s.rows.map((r) => r.id)).toEqual(["a", "b"]);
    expect(s.hasNext).toBe(true);
    expect(s.hasPrevious).toBe(false);
    expect(s.loading).toBe(false);
  });

  it("walks to the next page and back by cursor", async () => {
    fetchGameSessions.mockResolvedValueOnce(page(["a"], "c1"));
    fetchGameSessions.mockResolvedValueOnce(page(["b"], null));
    const { s } = section();
    await s.load(NOW);
    await s.next();
    expect(fetchGameSessions).toHaveBeenLastCalledWith(
      "SCORE_TRAINING",
      expect.objectContaining({ cursor: "c1", limit: 10 }),
    );
    expect(s.rows.map((r) => r.id)).toEqual(["b"]);
    expect(s.hasNext).toBe(false);
    expect(s.hasPrevious).toBe(true);
    expect(s.pageNumber).toBe(2);
    fetchGameSessions.mockResolvedValueOnce(page(["a"], "c1"));
    await s.previous();
    expect(fetchGameSessions.mock.calls[2][1]).not.toHaveProperty("cursor");
    expect(s.rows.map((r) => r.id)).toEqual(["a"]);
    expect(s.pageNumber).toBe(1);
  });

  it("derives the page count from the server total", async () => {
    fetchGameSessions.mockResolvedValue(page(["a"], "c1", 56));
    const { s } = section();
    await s.load(NOW);
    expect(s.totalPages).toBe(6);
    fetchGameSessions.mockResolvedValue(page(["a"], null, 10));
    await s.load(NOW);
    expect(s.totalPages).toBe(1);
  });

  it("has no page count when the page carries no total", async () => {
    fetchGameSessions.mockResolvedValue(page(["a"], null));
    const { s } = section();
    await s.load(NOW);
    expect(s.totalPages).toBeNull();
  });

  it("ignores next without a cursor", async () => {
    const { s } = section();
    await s.load(NOW);
    await s.next();
    await s.previous();
    expect(fetchGameSessions).toHaveBeenCalledTimes(1);
  });

  it("reports a load failure", async () => {
    fetchGameSessions.mockRejectedValue(new Error("boom"));
    const { s } = section();
    await s.load(NOW);
    expect(s.error).toBe("boom");
    expect(s.loading).toBe(false);
  });

  it("reloads when the page period changes", async () => {
    const { s, watchers } = section();
    s.init();
    await vi.waitFor(() => expect(s.loading).toBe(false));
    watchers.rangeKey();
    await vi.waitFor(() => expect(fetchGameSessions).toHaveBeenCalledTimes(2));
  });

  it("fetches the page-level game's sessions", async () => {
    const { s } = section("501_V1");
    await s.load(NOW);
    expect(fetchGameSessions).toHaveBeenCalledWith(
      "501",
      expect.objectContaining({ status: "completed", limit: 10 }),
    );
  });

  it("scopes the cache per game", async () => {
    const { s } = section("BOBS27_V1");
    await s.load(NOW);
    expect(readSessionPage.mock.calls[0][1]).toBe(
      `${gameScopeKey("BOBS27")}:counted`,
    );
  });

  it("reloads when the page game changes", async () => {
    const { s, watchers } = section();
    s.init();
    await vi.waitFor(() => expect(s.loading).toBe(false));
    watchers.game();
    await vi.waitFor(() => expect(fetchGameSessions).toHaveBeenCalledTimes(2));
  });

  it("shows the average for Score Training only", async () => {
    fetchGameSessions.mockResolvedValue(page(["a"], null));
    const score = section();
    await score.s.load(NOW);
    expect(score.s.caption(score.s.rows[0])).toBe(
      "9.0 avg · 30 darts · 10 min",
    );
    const other = section("501_V1");
    await other.s.load(NOW);
    expect(other.s.caption(other.s.rows[0])).toBe("30 darts · 10 min");
  });

  it("is empty when no sessions returned", async () => {
    const { s } = section();
    await s.load(NOW);
    expect(s.isEmpty).toBe(true);
  });
});
