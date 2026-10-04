import { beforeEach, describe, expect, it, vi } from "vitest";

const loadGameSection = vi.fn();

vi.mock("@lib/stats/load-game-section", () => ({
  loadGameSection: (...args: unknown[]) => loadGameSection(...args),
}));

const { periodSection } = await import("@lib/stats/sections/period-section");

const NOW = new Date("2026-10-01T10:00:00.000Z");
const DAY = 86_400_000;

function section() {
  const watchers: Record<string, () => void> = {};
  const page = {
    rangeKey: "30d" as "30d" | "90d" | "1y" | "all",
    game: "SCORE_TRAINING_V1",
  };
  const own = periodSection<{ n: number }>("completion");
  const s = Object.assign(own, {
    $data: page,
    $watch: (key: "rangeKey" | "game", cb: () => void) => {
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
});
