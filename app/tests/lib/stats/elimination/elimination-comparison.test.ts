import { describe, expect, it } from "vitest";
import {
  eliminationComparison,
  sumElimination,
} from "@lib/stats/elimination/elimination-comparison";
import { emptyEliminationMetrics } from "@modules/stats/sections/elimination.module";
import type { EliminationMetrics } from "@modules/types";

function metrics(edit: (m: EliminationMetrics) => void): EliminationMetrics {
  const m = emptyEliminationMetrics();
  edit(m);
  return m;
}

const bucket = (m: EliminationMetrics) => ({
  start: "2026-09-01T00:00:00.000Z",
  end: "2026-10-01T00:00:00.000Z",
  closed: true,
  sampleSize: 1,
  metrics: m,
});

describe("sumElimination", () => {
  it("sums every bucket, empty with none", () => {
    const one = metrics((m) => {
      m.games = 1;
      m.prisoner.reached = 5;
    });
    const sum = sumElimination([bucket(one), bucket(one)]);
    expect(sum.games).toBe(2);
    expect(sum.prisoner.reached).toBe(10);
    expect(sumElimination([])).toEqual(emptyEliminationMetrics());
  });

  it("leaves the buckets' metrics unchanged", () => {
    const games = (m: EliminationMetrics) => {
      m.games = 1;
    };
    const first = bucket(metrics(games));
    sumElimination([first, bucket(metrics(games))]);
    expect(first.metrics).toEqual(metrics(games));
  });
});

describe("eliminationComparison", () => {
  it("reads each measure's part and whole", () => {
    const m = metrics((x) => {
      x.finished = 4;
      x.wins = 3;
      x.darts = 60;
      x.livesLost = 2;
      x.killer = { killerGames: 2, dartsToKiller: 10, livesTaken: 6 };
      x.followTheLeader.matchVisits = 8;
      x.followTheLeader.matched = 5;
      x.followTheLeader.matchDarts = 9;
      x.prisoner.advance = 10;
      x.prisoner.advanceAndCapture = 2;
      x.prisoner.prison = 7;
      x.prisoner.reached = 30;
    });
    const c = eliminationComparison(m, null);
    expect(c.wins.current).toEqual({ part: 3, whole: 4 });
    expect(c.dartsToKiller.current).toEqual({ part: 10, whole: 2 });
    expect(c.dartsPerLife.current).toEqual({ part: 60, whole: 6 });
    expect(c.livesLost.current).toEqual({ part: 2, whole: 4 });
    expect(c.matchRate.current).toEqual({ part: 5, whole: 8 });
    expect(c.matchDarts.current).toEqual({ part: 9, whole: 5 });
    expect(c.advance.current).toEqual({ part: 12, whole: 60 });
    expect(c.prison.current).toEqual({ part: 7, whole: 60 });
    expect(c.reached.current).toEqual({ part: 30, whole: 4 });
    expect(c.wins.previous).toBeNull();
  });

  it("reads the previous period when given", () => {
    const c = eliminationComparison(
      emptyEliminationMetrics(),
      metrics((m) => {
        m.finished = 2;
        m.wins = 1;
      }),
    );
    expect(c.wins.previous).toEqual({ part: 1, whole: 2 });
  });

  it("gives every measure a null previous with no preceding period", () => {
    const c = eliminationComparison(emptyEliminationMetrics(), null);
    expect(Object.values(c).every((m) => m.previous === null)).toBe(true);
    expect(Object.keys(c)).toHaveLength(9);
  });
});
