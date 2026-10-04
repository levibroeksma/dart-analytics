import { describe, expect, it } from "vitest";
import {
  completionSummary,
  personalBestFinish,
  sessionRow,
  trebleSummary,
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
      abandonRate: null,
    });
  });

  it("sums counts and leaves never-started sessions out of the abandon rate", () => {
    const out = completionSummary([
      bucket({
        completed: 6,
        abandoned: 2,
        neverStarted: 5,
        abandonedTurns: 3,
      }),
      bucket({
        completed: 2,
        abandoned: 0,
        neverStarted: 4,
        abandonedTurns: 0,
      }),
    ]);
    expect(out).toEqual({ completed: 8, abandoned: 2, abandonRate: 0.2 });
  });

  it("has no rate when only never-started sessions exist", () => {
    const out = completionSummary([
      bucket({
        completed: 0,
        abandoned: 0,
        neverStarted: 3,
        abandonedTurns: 0,
      }),
    ]);
    expect(out.abandonRate).toBeNull();
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
    expect(row.href).toBe("/statistics/replay?session=s1");
    expect(row.date).toBe("1 oct. '26");
  });

  it("has no average without darts", () => {
    const row = sessionRow({ ...item, dartCount: 0 }, "UTC");
    expect(row.average).toBeNull();
  });
});

describe("personalBestFinish", () => {
  const ladder = (maxTarget: number | null) =>
    bucket({ targets: {}, maxTarget, afterMiss: 0, recovered: 0 });

  it("is the highest target reached across buckets minus one", () => {
    expect(personalBestFinish([ladder(125), ladder(140), ladder(130)])).toBe(
      139,
    );
  });

  it("is null without an attempt", () => {
    expect(personalBestFinish([])).toBeNull();
    expect(personalBestFinish([ladder(null)])).toBeNull();
  });
});
