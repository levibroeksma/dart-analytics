import { beforeEach, describe, expect, it, vi } from "vitest";

const readSessionPage = vi.fn();
const fetchGameSessions = vi.fn();

vi.mock("@client/stats-cache/cache", () => ({
  readSessionPage: (...args: unknown[]) => readSessionPage(...args),
}));
vi.mock("@client/api/statistics", () => ({
  fetchGameSessions: (...args: unknown[]) => fetchGameSessions(...args),
}));

const { scoreSessionList } =
  await import("@lib/stats/sections/score-session-list.data");

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

function page(ids: string[], nextCursor: string | null) {
  return { items: ids.map(item), nextCursor, dataVersion: "v1" };
}

function section() {
  const watchers: Record<string, () => void> = {};
  const data = { rangeKey: "30d" as "30d" | "90d" | "1y" | "all" };
  const own = scoreSessionList();
  const s = Object.assign(own, {
    $data: data,
    $watch: (key: "rangeKey", cb: () => void) => {
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

describe("scoreSessionList", () => {
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
    expect(s.rows.map((r) => r.href)).toEqual([
      "/statistics/replay?session=a",
      "/statistics/replay?session=b",
    ]);
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
    expect(s.pageLabel).toBe("Page 2");
    fetchGameSessions.mockResolvedValueOnce(page(["a"], "c1"));
    await s.previous();
    expect(fetchGameSessions.mock.calls[2][1]).not.toHaveProperty("cursor");
    expect(s.rows.map((r) => r.id)).toEqual(["a"]);
    expect(s.pageLabel).toBe("Page 1");
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

  it("is empty when no sessions returned", async () => {
    const { s } = section();
    await s.load(NOW);
    expect(s.isEmpty).toBe(true);
  });
});
