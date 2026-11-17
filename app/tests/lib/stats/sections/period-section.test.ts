import { beforeEach, describe, expect, it, vi } from "vitest";

const loadGameSection = vi.fn();

vi.mock("@lib/stats/load-game-section", () => ({
  loadGameSection: (...args: unknown[]) => loadGameSection(...args),
}));

const { latestCardLoad, periodSection } =
  await import("@lib/stats/sections/period-section");

const NOW = new Date("2026-10-01T10:00:00.000Z");
const DAY = 86_400_000;

function section() {
  const watchers: Record<string, () => void> = {};
  const page = {
    rangeKey: "30d" as "30d" | "90d" | "1y" | "all",
    game: "SCORE_TRAINING_V1",
    variation: 501,
  };
  const own = periodSection<{ n: number }>("completion");
  const s = Object.assign(own, {
    $data: page,
    $watch: (key: "rangeKey" | "game" | "variation", cb: () => void) => {
      watchers[key] = cb;
    },
  });
  return { s, watchers, page };
}

beforeEach(() => {
  loadGameSection.mockReset();
  loadGameSection.mockResolvedValue({ buckets: [] });
});

describe("periodSection", () => {
  it("starts loading and reads the page period", () => {
    const { s } = section();
    expect(s.loading).toBe(true);
    expect(s.period()).toBe("30d");
  });

  it("requests the section un-bucketed over the current period", async () => {
    const { s } = section();
    await s.load(NOW);
    expect(loadGameSection).toHaveBeenCalledWith(
      "SCORE_TRAINING",
      "completion",
      {
        from: new Date(NOW.getTime() - 30 * DAY).toISOString(),
        to: new Date(NOW.getTime() + 60_000).toISOString(),
        bucket: "none",
      },
    );
  });

  it("requests the page-level game's type", async () => {
    const { s, page } = section();
    page.game = "501_V1";
    await s.load(NOW);
    expect(loadGameSection.mock.calls[0].slice(0, 2)).toEqual([
      "501",
      "completion",
    ]);
  });

  it("makes no request for an unknown game", async () => {
    const { s, page } = section();
    page.game = "NOPE";
    await s.load(NOW);
    expect(loadGameSection).not.toHaveBeenCalled();
    expect(s.loading).toBe(false);
    expect(s.buckets).toEqual([]);
  });

  it("reloads when the page game changes", async () => {
    const { s, watchers, page } = section();
    s.init();
    await vi.waitFor(() => expect(s.loading).toBe(false));
    page.game = "TUOD_V1";
    watchers.game();
    await vi.waitFor(() => expect(loadGameSection).toHaveBeenCalledTimes(2));
    expect(loadGameSection.mock.calls[1][0]).toBe("TUOD");
  });

  it("stores the buckets and stops loading", async () => {
    const bucketRow = {
      start: "a",
      end: "b",
      closed: true,
      sampleSize: 1,
      metrics: { n: 1 },
    };
    loadGameSection.mockResolvedValue({ buckets: [bucketRow] });
    const { s } = section();
    await s.load(NOW);
    expect(s.buckets).toEqual([bucketRow]);
    expect(s.loading).toBe(false);
    expect(s.error).toBeNull();
  });

  it("surfaces a failure as the error message", async () => {
    loadGameSection.mockRejectedValue(new Error("boom"));
    const { s } = section();
    await s.load(NOW);
    expect(s.error).toBe("boom");
    expect(s.loading).toBe(false);
  });

  it("reloads when the page period changes", async () => {
    const { s, watchers, page } = section();
    s.init();
    await vi.waitFor(() => expect(s.loading).toBe(false));
    page.rangeKey = "90d";
    watchers.rangeKey();
    await vi.waitFor(() => expect(loadGameSection).toHaveBeenCalledTimes(2));
    const second = loadGameSection.mock.calls[1][2] as { from: string };
    expect(Date.parse(second.from)).toBeLessThan(Date.now() - 80 * DAY);
  });

  it("drops a stale response", async () => {
    let resolveFirst: (v: unknown) => void = () => {};
    loadGameSection
      .mockImplementationOnce(
        () => new Promise((resolve) => (resolveFirst = resolve)),
      )
      .mockResolvedValueOnce({
        buckets: [
          {
            start: "n",
            end: "n",
            closed: true,
            sampleSize: 1,
            metrics: { n: 2 },
          },
        ],
      });
    const { s } = section();
    const first = s.load(NOW);
    await s.load(NOW);
    resolveFirst({
      buckets: [
        {
          start: "o",
          end: "o",
          closed: true,
          sampleSize: 1,
          metrics: { n: 1 },
        },
      ],
    });
    await first;
    expect(s.buckets[0].metrics.n).toBe(2);
  });

  it("refetches with variation=301 after the page variation changes", async () => {
    const { s, watchers, page } = section();
    page.game = "501_V1";
    s.init();
    await vi.waitFor(() => expect(s.loading).toBe(false));
    expect(loadGameSection.mock.calls[0][2].variation).toBe(501);
    page.variation = 301;
    watchers.variation();
    await vi.waitFor(() => expect(loadGameSection).toHaveBeenCalledTimes(2));
    expect(loadGameSection.mock.calls[1][2].variation).toBe(301);
  });

  it("drops a stale response after a quick 301 → 501 switch", async () => {
    let resolveFirst: (v: unknown) => void = () => {};
    const row = (n: number) => ({
      start: "a",
      end: "b",
      closed: true,
      sampleSize: 1,
      metrics: { n },
    });
    loadGameSection
      .mockImplementationOnce(
        () => new Promise((resolve) => (resolveFirst = resolve)),
      )
      .mockResolvedValueOnce({ buckets: [row(501)] });
    const { s, page } = section();
    page.game = "501_V1";
    page.variation = 301;
    const first = s.load(NOW);
    page.variation = 501;
    await s.load(NOW);
    resolveFirst({ buckets: [row(301)] });
    await first;
    expect(s.buckets[0].metrics.n).toBe(501);
  });

  it("does not send variation for a non-501 game", async () => {
    const { s, page } = section();
    page.game = "TUOD_V1";
    page.variation = 301;
    await s.load(NOW);
    expect(loadGameSection.mock.calls[0][2].variation).toBeUndefined();
  });
});

describe("periodSection skippedSessions", () => {
  it("carries the series skipped count and resets on the next load", async () => {
    loadGameSection.mockResolvedValueOnce({ buckets: [], skippedSessions: 4 });
    const { s } = section();
    await s.load(NOW);
    expect(s.skippedSessions).toBe(4);
    loadGameSection.mockResolvedValueOnce({ buckets: [] });
    await s.load(NOW);
    expect(s.skippedSessions).toBe(0);
  });
});

describe("latestCardLoad", () => {
  function cardScope() {
    return {
      $data: { rangeKey: "30d" as const, game: "SHANGHAI_V1" },
      loading: false,
      error: "old" as string | null,
      card: "empty",
    };
  }

  it("passes the page game and period, then lands the card", async () => {
    const fetchCard = vi.fn().mockResolvedValue({ card: "full", error: null });
    const scope = cardScope();
    await latestCardLoad(fetchCard).call(scope, NOW);
    expect(fetchCard).toHaveBeenCalledWith("SHANGHAI_V1", "30d", NOW);
    expect(scope).toMatchObject({ card: "full", error: null, loading: false });
  });

  it("lands the error beside an empty card", async () => {
    const fetchCard = vi
      .fn()
      .mockResolvedValue({ card: "empty", error: "boom" });
    const scope = cardScope();
    await latestCardLoad(fetchCard).call(scope, NOW);
    expect(scope).toMatchObject({ error: "boom", loading: false });
  });

  it("drops a response that arrives after a newer load", async () => {
    let release: (value: { card: string; error: null }) => void = () => {};
    const slow = new Promise<{ card: string; error: null }>(
      (resolve) => (release = resolve),
    );
    const fetchCard = vi
      .fn()
      .mockReturnValueOnce(slow)
      .mockResolvedValue({ card: "new", error: null });
    const load = latestCardLoad(fetchCard);
    const scope = cardScope();
    const first = load.call(scope, NOW);
    await load.call(scope, NOW);
    release({ card: "stale", error: null });
    await first;
    expect(scope.card).toBe("new");
  });
});
