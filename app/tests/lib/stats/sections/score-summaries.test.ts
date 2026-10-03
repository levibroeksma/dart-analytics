import { describe, expect, it } from "vitest";
import {
  completionSummary,
  scoreResultSummary,
  sessionRow,
  trebleSummary,
  volumeSummary,
} from "@lib/stats/sections/score-summaries";

function bucket<M>(metrics: M) {
  return { start: "a", end: "b", closed: true, sampleSize: 1, metrics };
}

describe("trebleSummary", () => {
  it("returns null rates below the minimum sample", () => {
    const out = trebleSummary([bucket({ "20": { darts: 10, trebles: 5 } })]);
    expect(out).toEqual({ t20: null, t19: null, overall: null });
  });

  it("sums buckets and reads T20, T19 and the overall share", () => {
    const out = trebleSummary([
      bucket({
        "20": { darts: 20, trebles: 10 },
        "19": { darts: 40, trebles: 10 },
      }),
      bucket({
        "20": { darts: 20, trebles: 10 },
        MISS: { darts: 20, trebles: 0 },
      }),
    ]);
    expect(out.t20).toBeCloseTo(0.5);
    expect(out.t19).toBeCloseTo(0.25);
    expect(out.overall).toBeCloseTo(30 / 100);
  });
});

describe("completionSummary", () => {
  it("is empty without buckets", () => {
    expect(completionSummary([])).toEqual({
      completed: 0,
      abandoned: 0,
      neverStarted: 0,
      abandonRate: null,
    });
  });

  it("sums counts and counts never-started towards the abandon rate", () => {
    const out = completionSummary([
      bucket({
        completed: 6,
        abandoned: 1,
        neverStarted: 1,
        abandonedTurns: 3,
      }),
      bucket({
        completed: 2,
        abandoned: 0,
        neverStarted: 0,
        abandonedTurns: 0,
      }),
    ]);
    expect(out).toEqual({
      completed: 8,
      abandoned: 1,
      neverStarted: 1,
      abandonRate: 0.2,
    });
  });
});

describe("volumeSummary", () => {
  it("adds the context split and converts seconds to minutes", () => {
    const out = volumeSummary([
      bucket({
        sessions: { standalone: 2, routine: 1 },
        darts: { standalone: 30, routine: 9 },
        durationSeconds: { standalone: 600, routine: 90 },
      }),
    ]);
    expect(out).toEqual({ sessions: 3, darts: 39, minutes: 12 });
  });
});

describe("scoreResultSummary", () => {
  const slice = (over: Record<string, unknown>) => ({
    sessions: 2,
    countedScoreSum: 400,
    dartSum: 60,
    turnSum: 20,
    countedScoreMin: 150,
    countedScoreMax: 250,
    bestLowSessionId: "low",
    bestHighSessionId: "high",
    bestAverage: null,
    ...over,
  });

  it("is empty without slices", () => {
    expect(scoreResultSummary([bucket({})])).toEqual({
      sessions: 0,
      average: null,
      best: null,
    });
  });

  it("averages counted score and keeps the best session across slices", () => {
    const out = scoreResultSummary([
      bucket({ SCORE_TRAINING_V1: slice({}) }),
      bucket({
        SCORE_TRAINING_V1: slice({
          sessions: 1,
          countedScoreSum: 300,
          countedScoreMax: 300,
          bestHighSessionId: "top",
        }),
      }),
    ]);
    expect(out.sessions).toBe(3);
    expect(out.average).toBeCloseTo(700 / 3);
    expect(out.best).toEqual({ value: 300, sessionId: "top" });
  });
});

describe("sessionRow", () => {
  const item = {
    sessionId: "s1",
    rulesetVersionKey: "SCORE_TRAINING_V1",
    statusKey: "COMPLETED",
    contextKey: "STANDALONE",
    neverStarted: false,
    startedAt: "2026-10-01T10:00:00.000Z",
    completedAt: "2026-10-01T10:30:00.000Z",
    durationSeconds: 1800,
    turnCount: 10,
    dartCount: 30,
    countedScore: 150,
  };

  it("derives the 3-dart average, minutes and the replay link", () => {
    const row = sessionRow(item, "UTC");
    expect(row.average).toBe(15);
    expect(row.minutes).toBe(30);
    expect(row.darts).toBe(30);
    expect(row.abandoned).toBe(false);
    expect(row.href).toBe("/statistics/replay?session=s1");
    expect(row.date).toBe("1 oct. '26");
  });

  it("has no average without darts and flags a non-completed session", () => {
    const row = sessionRow(
      { ...item, dartCount: 0, statusKey: "ABANDONED" },
      "UTC",
    );
    expect(row.average).toBeNull();
    expect(row.abandoned).toBe(true);
  });
});
