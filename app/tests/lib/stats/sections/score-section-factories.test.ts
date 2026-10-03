import { beforeEach, describe, expect, it, vi } from "vitest";

const loadGameSection = vi.fn();

vi.mock("@lib/stats/load-game-section", () => ({
  loadGameSection: (...args: unknown[]) => loadGameSection(...args),
}));

const { scoreTrebleSection } =
  await import("@lib/stats/sections/score-treble.data");
const { scoreCompletionSection } =
  await import("@lib/stats/sections/score-completion.data");
const { scoreResultSection } =
  await import("@lib/stats/sections/score-result.data");

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

  it("scoreCompletionSection ignores never-started sessions and splits the donut", async () => {
    respond({ completed: 3, abandoned: 1, neverStarted: 9, abandonedTurns: 2 });
    const s = mounted(scoreCompletionSection());
    await s.load();
    expect(s.total).toBe(4);
    expect(s.summary.abandonRate).toBe(0.25);
    const c = s.circumference;
    expect(s.completedArc).toBe(`${c * 0.75} ${c}`);
    expect(s.abandonedArc).toBe(`${c * 0.25} ${c}`);
    expect(s.abandonedOffset).toBe(-c * 0.75);
  });

  it("scoreCompletionSection draws an empty ring without started sessions", async () => {
    respond({ completed: 0, abandoned: 0, neverStarted: 2, abandonedTurns: 0 });
    const s = mounted(scoreCompletionSection());
    await s.load();
    expect(s.total).toBe(0);
    expect(s.completedArc).toBe(`0 ${s.circumference}`);
    expect(s.abandonedArc).toBe(`0 ${s.circumference}`);
  });

  it("scoreResultSection requests session-result and summarises it", async () => {
    respond({
      SCORE_TRAINING_V1: {
        sessions: 1,
        countedScoreSum: 120,
        dartSum: 30,
        turnSum: 10,
        countedScoreMin: 120,
        countedScoreMax: 120,
        bestLowSessionId: "s",
        bestHighSessionId: "s",
        bestAverage: null,
      },
    });
    const s = mounted(scoreResultSection());
    await s.load();
    expect(loadGameSection.mock.calls[0][1]).toBe("session-result");
    expect(s.summary.best).toEqual({ value: 120, sessionId: "s" });
    expect(s.replayHref("s")).toBe("/statistics/replay?session=s");
  });
});
