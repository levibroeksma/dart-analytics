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
  const page = { rangeKey: "30d" as "30d" | "90d" | "1y" | "all" };
  const own = scoreTrendSection();
  const scope = new Proxy(page, {
    get: (target, key) =>
      key in own ? Reflect.get(own, key) : target[key as "rangeKey"],
    set: (target, key, value) => Reflect.set(target, key, value),
  });
  const s = Object.assign(own, {
    $data: scope,
    $watch: (key: "rangeKey", cb: () => void) => {
      watchers[key] = cb;
    },
  });
  return { s, watchers, page };
}

beforeEach(() => {
  loadGameSection.mockReset();
  loadGameSection.mockResolvedValue(series([]));
});

describe("scoreTrendSection", () => {
  it("starts loading and reads the page period", () => {
    const { s, page } = section();
    expect(s.period).toBe("30d");
    page.rangeKey = "1y";
    expect(s.period).toBe("1y");
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
    const { s, watchers, page } = section();
    s.init();
    await vi.waitFor(() => expect(s.loading).toBe(false));
    page.rangeKey = "90d";
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
    expect(s.threeDartDeltaPercent).toBeCloseTo(20);
    expect(s.firstNineDeltaPercent).toBeCloseTo(20);
    expect(s.isEmpty).toBe(false);
  });

  it("shows empty state when no data", async () => {
    const { s, page } = section();
    page.rangeKey = "all";
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
    const { s, page } = section();
    page.rangeKey = "all";
    await s.load(NOW);
    expect(loadGameSection).toHaveBeenCalledTimes(2);
    expect(loadGameSection.mock.calls[1][2]).toMatchObject({
      bucket: "week",
      from: "2026-08-31T22:00:00.000Z",
    });
    expect(s.bucket).toBe("week");
    expect(s.hasPrevious).toBe(false);
    expect(s.threeDartDeltaPercent).toBeNull();
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
    const { s, page } = section();
    const slow = s.load(NOW);
    page.rangeKey = "90d";
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
