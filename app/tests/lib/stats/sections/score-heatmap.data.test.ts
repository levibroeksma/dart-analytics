import { beforeEach, describe, expect, it, vi } from "vitest";

const loadGameSection = vi.fn();

vi.mock("@lib/stats/load-game-section", () => ({
  loadGameSection: (...args: unknown[]) => loadGameSection(...args),
}));

const { scoreHeatmapSection } =
  await import("@lib/stats/sections/score-heatmap.data");
const { HEAT_PEAK_ALPHA } =
  await import("@modules/stats/sections/heatmap-density.module");

const NOW = new Date("2026-10-01T10:00:00.000Z");
const DAY = 86_400_000;

function series(cells: [number, number, number][]) {
  return {
    buckets:
      cells.length === 0
        ? []
        : [
            {
              start: "a",
              end: "b",
              closed: true,
              sampleSize: cells.reduce((n, [, , d]) => n + d, 0),
              metrics: { cellMm: 5, target: null, cells },
            },
          ],
  };
}

function section() {
  const watchers: Record<string, () => void> = {};
  const page = { rangeKey: "30d" as "30d" | "90d" | "1y" | "all" };
  const own = scoreHeatmapSection();
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

describe("scoreHeatmapSection", () => {
  it("starts loading and reads the page period", () => {
    const { s, page } = section();
    expect(s.period).toBe("30d");
    page.rangeKey = "1y";
    expect(s.period).toBe("1y");
    expect(s.loading).toBe(true);
  });

  it("init loads heatmap for SCORE_TRAINING un-bucketed over the current period", async () => {
    const { s } = section();
    s.init();
    await vi.waitFor(() => expect(s.loading).toBe(false));
    expect(loadGameSection).toHaveBeenCalledTimes(1);
    const [game, id, range] = loadGameSection.mock.calls[0];
    expect(game).toBe("SCORE_TRAINING");
    expect(id).toBe("heatmap");
    expect(range.bucket).toBe("none");
    expect(range).not.toHaveProperty("tz");
    expect(range).not.toHaveProperty("target");
  });

  it("requests only the current period, not the doubled trend window", async () => {
    const { s } = section();
    await s.load(NOW);
    expect(loadGameSection.mock.calls[0][2].from).toBe(
      new Date(NOW.getTime() - 30 * DAY).toISOString(),
    );
  });

  it("reloads when rangeKey changes", async () => {
    const { s, watchers, page } = section();
    s.init();
    await vi.waitFor(() => expect(s.loading).toBe(false));
    page.rangeKey = "90d";
    watchers.rangeKey();
    await vi.waitFor(() => expect(loadGameSection).toHaveBeenCalledTimes(2));
  });

  it("derives density stamps from the loaded cells", async () => {
    loadGameSection.mockResolvedValue(
      series([
        [0, 0, 4],
        [2, -1, 2],
      ]),
    );
    const { s } = section();
    await s.load(NOW);
    expect(s.isEmpty).toBe(false);
    expect(s.stamps).toHaveLength(2);
    expect(s.stamps[0].alpha).toBe(HEAT_PEAK_ALPHA);
    expect(s.stamps[1].alpha).toBeCloseTo(HEAT_PEAK_ALPHA * Math.SQRT1_2);
  });

  it("shows empty state when no data", async () => {
    const { s } = section();
    await s.load(NOW);
    expect(s.isEmpty).toBe(true);
    expect(s.stamps).toEqual([]);
    expect(s.error).toBeNull();
  });

  it("surfaces a load failure", async () => {
    loadGameSection.mockRejectedValue(new Error("offline"));
    const { s } = section();
    await s.load(NOW);
    expect(s.error).toBe("offline");
    expect(s.loading).toBe(false);
  });

  it("ignores a stale response that resolves after a newer load", async () => {
    let resolveFirst: (v: unknown) => void = () => {};
    loadGameSection
      .mockImplementationOnce(
        () => new Promise((resolve) => (resolveFirst = resolve)),
      )
      .mockResolvedValueOnce(series([[1, 1, 1]]));
    const { s } = section();
    const first = s.load(NOW);
    await s.load(NOW);
    expect(s.stamps).toHaveLength(1);
    resolveFirst(series([]));
    await first;
    expect(s.stamps).toHaveLength(1);
  });
});
