import { beforeEach, describe, expect, it, vi } from "vitest";

const loadGameSection = vi.fn();

vi.mock("@lib/stats/load-game-section", () => ({
  loadGameSection: (...args: unknown[]) => loadGameSection(...args),
}));

const { scoreTrebleSection } =
  await import("@lib/stats/sections/score-treble.data");
const { scoreCompletionSection } =
  await import("@lib/stats/sections/score-completion.data");

function mounted<T extends { init(): void }>(factory: T) {
  return Object.assign(factory, {
    $data: { rangeKey: "30d" },
    $watch: () => {},
  });
}

function respond(metrics: unknown) {
  loadGameSection.mockResolvedValue({
    buckets: [{ start: "a", end: "b", closed: true, sampleSize: 1, metrics }],
  });
}

beforeEach(() => loadGameSection.mockReset());

describe("score section factories", () => {
  it("scoreTrebleSection requests treble-rate and summarises it", async () => {
    respond({ "20": { darts: 40, trebles: 10 } });
    const s = mounted(scoreTrebleSection());
    await s.load();
    expect(loadGameSection.mock.calls[0].slice(0, 2)).toEqual([
      "SCORE_TRAINING",
      "treble-rate",
    ]);
    expect(s.summary.t20).toBe(0.25);
    expect(s.fmtRate(0.25)).toBe("25%");
    expect(s.fmtRate(null)).toBe("—");
  });

  it("scoreCompletionSection requests completion and summarises it", async () => {
    respond({ completed: 3, abandoned: 1, neverStarted: 0, abandonedTurns: 2 });
    const s = mounted(scoreCompletionSection());
    await s.load();
    expect(loadGameSection.mock.calls[0][1]).toBe("completion");
    expect(s.summary.abandonRate).toBe(0.25);
  });

  it("scoreCompletionSection ignores never-started sessions and builds a doughnut", async () => {
    respond({ completed: 3, abandoned: 1, neverStarted: 9, abandonedTurns: 2 });
    const s = mounted(scoreCompletionSection());
    await s.load();
    expect(s.isEmpty).toBe(false);
    expect(s.summary.abandonRate).toBe(0.25);
    expect(s.chart.kind).toBe("doughnut");
    expect(s.chart.labels).toEqual(["Completed · 3", "Abandoned · 1"]);
    expect(s.chart.series[0].data).toEqual([3, 1]);
    expect(s.chart.series[0].sliceColors).toEqual(["emerald", "rose"]);
  });

  it("scoreCompletionSection is empty with only never-started sessions", async () => {
    respond({ completed: 0, abandoned: 0, neverStarted: 2, abandonedTurns: 0 });
    const s = mounted(scoreCompletionSection());
    await s.load();
    expect(s.isEmpty).toBe(true);
  });
});
