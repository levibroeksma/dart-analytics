import { beforeEach, describe, expect, it, vi } from "vitest";

const loadGameSection = vi.fn();

vi.mock("@lib/stats/load-game-section", () => ({
  loadGameSection: (...args: unknown[]) => loadGameSection(...args),
}));

const { scoreTrendSection } =
  await import("@lib/stats/sections/score-trend.data");

const NOW = new Date("2026-10-01T10:00:00.000Z");

function bucket(start: string, end: string, points: number, darts: number) {
  return {
    start,
    end,
    closed: true,
    sampleSize: darts > 0 ? 1 : 0,
    metrics: {
      points,
      darts,
      firstNinePoints: points,
      firstNineDarts: darts,
      bands: { ton: 0, tonForty: 0, oneEighty: 0 },
    },
  };
}

function series(buckets: unknown[]) {
  return { buckets };
}

function section() {
  const watchers: Record<string, () => void> = {};
  const s = Object.assign(scoreTrendSection(), {
    $watch: (key: "rangeKey", cb: () => void) => {
      watchers[key] = cb;
    },
  });
  return { s, watchers };
}

beforeEach(() => {
  loadGameSection.mockReset();
  loadGameSection.mockResolvedValue(series([]));
});

describe("scoreTrendSection", () => {
  it("starts on Last 30 Days and loading", () => {
    const { s } = section();
    expect(s.rangeKey).toBe("30d");
    expect(s.loading).toBe(true);
  });

  it("init loads scoring-trend for SCORE_TRAINING with a day window", async () => {
    const { s } = section();
    s.init();
    await vi.waitFor(() => expect(s.loading).toBe(false));
    expect(loadGameSection).toHaveBeenCalledTimes(1);
    const [game, id, range] = loadGameSection.mock.calls[0];
    expect(game).toBe("SCORE_TRAINING");
    expect(id).toBe("scoring-trend");
    expect(range.bucket).toBe("day");
    expect(range).not.toHaveProperty("boundary");
  });

  it("reloads when rangeKey changes", async () => {
    const { s, watchers } = section();
    s.init();
    await vi.waitFor(() => expect(s.loading).toBe(false));
    s.rangeKey = "90d";
    watchers.rangeKey();
    await vi.waitFor(() => expect(loadGameSection).toHaveBeenCalledTimes(2));
    expect(loadGameSection.mock.calls[1][2].bucket).toBe("week");
  });

  it("splits current and previous and derives averages and deltas", async () => {
    loadGameSection.mockResolvedValue(
      series([
        bucket("2026-08-10T00:00:00.000Z", "2026-08-11T00:00:00.000Z", 150, 9),
        bucket("2026-09-20T00:00:00.000Z", "2026-09-21T00:00:00.000Z", 180, 9),
      ]),
    );
    const { s } = section();
    await s.load(NOW);
    expect(s.averages).toEqual({ threeDart: 60, firstNine: 60 });
    expect(s.threeDartDelta).toBe(10);
    expect(s.firstNineDelta).toBe(10);
    expect(s.isEmpty).toBe(false);
  });

  it("shows empty state when no data", async () => {
    const { s } = section();
    s.rangeKey = "all";
    await s.load(NOW);
    expect(loadGameSection).toHaveBeenCalledTimes(1);
    expect(s.isEmpty).toBe(true);
    expect(s.error).toBeNull();
  });

  it("refetches week buckets for All Time when data spans under 4 months", async () => {
    loadGameSection
      .mockResolvedValueOnce(
        series([
          bucket(
            "2026-08-31T22:00:00.000Z",
            "2026-09-30T22:00:00.000Z",
            300,
            9,
          ),
        ]),
      )
      .mockResolvedValueOnce(
        series([
          bucket(
            "2026-09-06T22:00:00.000Z",
            "2026-09-13T22:00:00.000Z",
            300,
            9,
          ),
        ]),
      );
    const { s } = section();
    s.rangeKey = "all";
    await s.load(NOW);
    expect(loadGameSection).toHaveBeenCalledTimes(2);
    expect(loadGameSection.mock.calls[1][2]).toMatchObject({
      bucket: "week",
      from: "2026-08-31T22:00:00.000Z",
    });
    expect(s.bucket).toBe("week");
    expect(s.hasPrevious).toBe(false);
    expect(s.threeDartDelta).toBeNull();
  });

  it("does not refetch for Last 30 Days", async () => {
    loadGameSection.mockResolvedValue(
      series([
        bucket("2026-09-20T00:00:00.000Z", "2026-09-21T00:00:00.000Z", 180, 9),
      ]),
    );
    const { s } = section();
    await s.load(NOW);
    expect(loadGameSection).toHaveBeenCalledTimes(1);
  });

  it("records an error and clears loading", async () => {
    loadGameSection.mockRejectedValue(new Error("boom"));
    const { s } = section();
    await s.load(NOW);
    expect(s.error).toBe("boom");
    expect(s.loading).toBe(false);
  });

  it("ignores a superseded response", async () => {
    let resolveSlow: (v: unknown) => void = () => {};
    loadGameSection
      .mockImplementationOnce(() => new Promise((r) => (resolveSlow = r)))
      .mockResolvedValueOnce(
        series([
          bucket(
            "2026-09-20T00:00:00.000Z",
            "2026-09-21T00:00:00.000Z",
            180,
            9,
          ),
        ]),
      );
    const { s } = section();
    const slow = s.load(NOW);
    s.rangeKey = "90d";
    await s.load(NOW);
    resolveSlow(
      series([
        bucket("2026-09-20T00:00:00.000Z", "2026-09-21T00:00:00.000Z", 30, 9),
      ]),
    );
    await slow;
    expect(s.averages.threeDart).toBe(60);
    expect(s.bucket).toBe("week");
    expect(s.loading).toBe(false);
  });
});
