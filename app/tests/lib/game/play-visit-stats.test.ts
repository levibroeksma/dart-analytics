import { describe, it, expect } from "vitest";
import {
  previousScoreDisplay,
  dartsThrownCount,
  perVisitAverageDisplay,
  threeDartAverageDisplay,
  accuracyDisplay,
  firstNineAverageDisplay,
  highestVisitScore,
  visitScoreBandCounts,
} from "@lib/game/play-visit-stats";

describe("previousScoreDisplay", () => {
  it('returns "—" when there are no turns', () => {
    expect(previousScoreDisplay([])).toBe("—");
  });

  it("returns the last turn totalScore as a string", () => {
    expect(previousScoreDisplay([{ totalScore: 60 }, { totalScore: 45 }])).toBe(
      "45",
    );
  });
});

const done = (totalScore: number) => ({
  totalScore,
  completedAt: "2026-08-09T00:00:00.000Z",
  darts: [],
});

describe("dartsThrownCount", () => {
  it("returns 0 for zero turns", () => {
    expect(dartsThrownCount([], 3)).toBe(0);
  });

  it("multiplies completed turn count by maxDartsPerTurn", () => {
    expect(dartsThrownCount([done(60), done(45)], 3)).toBe(6);
  });

  it("honours a non-default maxDartsPerTurn", () => {
    expect(dartsThrownCount([done(60), done(45)], 4)).toBe(8);
  });

  it("counts a quick-score turn with no completedAt field as complete", () => {
    expect(dartsThrownCount([{ totalScore: 60 }, { totalScore: 45 }], 3)).toBe(
      6,
    );
  });

  it("counts only the darts actually thrown in the visit still open", () => {
    const turns = [
      done(60),
      { totalScore: 60, completedAt: null, darts: [{}] },
    ];
    expect(dartsThrownCount(turns, 3)).toBe(4);
  });
});

describe("perVisitAverageDisplay", () => {
  it('returns "0.0" when there are no turns', () => {
    expect(perVisitAverageDisplay([])).toBe("0.0");
  });

  it("returns the per-visit average to one decimal place", () => {
    expect(
      perVisitAverageDisplay([{ totalScore: 60 }, { totalScore: 45 }]),
    ).toBe("52.5");
  });
});

describe("threeDartAverageDisplay", () => {
  it('returns "0.0" when there are no darts', () => {
    expect(threeDartAverageDisplay([], 3)).toBe("0.0");
  });

  it("matches per-visit average under turn×max dart counting", () => {
    const turns = [{ totalScore: 60 }, { totalScore: 45 }];
    expect(threeDartAverageDisplay(turns, 3)).toBe("52.5");
    expect(threeDartAverageDisplay(turns, 3)).toBe(
      perVisitAverageDisplay(turns),
    );
  });
});

/**
 * Board sessions leave the visit being thrown open until its third dart. Every
 * completed-visit statistic must exclude it: an open turn carries a running
 * total, not a result, so folding it in reports the middle of a visit as the
 * end of one. Quick-score turns are stamped complete when written, so none of
 * this changes their behaviour — pinned below.
 */
describe("open visits are excluded from completed-visit statistics", () => {
  const complete = (totalScore: number) => ({
    totalScore,
    completedAt: "2026-08-09T00:00:00.000Z",
    darts: [{}, {}, {}],
  });
  const openWith = (totalScore: number, dartCount: number) => ({
    totalScore,
    completedAt: null,
    darts: Array.from({ length: dartCount }, () => ({})),
  });

  it("previousScoreDisplay reports the last COMPLETED visit, not the open one's running total", () => {
    expect(previousScoreDisplay([complete(45), openWith(60, 1)])).toBe("45");
  });

  it('previousScoreDisplay is "—" when only an open visit exists', () => {
    expect(previousScoreDisplay([openWith(60, 1)])).toBe("—");
  });

  it("threeDartAverageDisplay ignores the open visit rather than averaging a third of it", () => {
    expect(threeDartAverageDisplay([complete(60), openWith(60, 1)], 3)).toBe(
      "60.0",
    );
  });

  it('threeDartAverageDisplay is "0.0" when only an open visit exists', () => {
    expect(threeDartAverageDisplay([openWith(180, 3)], 3)).toBe("0.0");
  });

  it("perVisitAverageDisplay ignores the open visit", () => {
    expect(perVisitAverageDisplay([complete(60), openWith(20, 1)])).toBe(
      "60.0",
    );
  });

  it("leaves a quick-score session unchanged — no turn is ever open", () => {
    const quickScore = [complete(60), complete(45), complete(81)];
    expect(previousScoreDisplay(quickScore)).toBe("81");
    expect(perVisitAverageDisplay(quickScore)).toBe("62.0");
    expect(threeDartAverageDisplay(quickScore, 3)).toBe("62.0");
    expect(dartsThrownCount(quickScore, 3)).toBe(9);
  });
});

describe("accuracyDisplay", () => {
  it('returns "0.00%" when no darts have been thrown', () => {
    expect(accuracyDisplay(0, 0)).toBe("0.00%");
  });

  it("formats an exact percentage to 2 decimal places", () => {
    expect(accuracyDisplay(1, 2)).toBe("50.00%");
  });

  it("formats a repeating-decimal percentage to 2 decimal places, not rounded to a whole number", () => {
    expect(accuracyDisplay(1, 3)).toBe("33.33%");
  });

  it("formats 100% with 2 decimal places", () => {
    expect(accuracyDisplay(63, 63)).toBe("100.00%");
  });
});

describe("firstNineAverageDisplay", () => {
  it('returns "0.0" when there are no completed visits', () => {
    expect(firstNineAverageDisplay([])).toBe("0.0");
  });

  it("averages a single completed visit", () => {
    expect(firstNineAverageDisplay([done(60)])).toBe("60.0");
  });

  it("averages exactly the first 3 completed visits, ignoring later ones", () => {
    const turns = [done(60), done(45), done(30), done(180)];
    expect(firstNineAverageDisplay(turns)).toBe("45.0");
  });

  it("averages over fewer than 3 visits when only 2 have completed", () => {
    expect(firstNineAverageDisplay([done(60), done(30)])).toBe("45.0");
  });

  it("ignores an open visit at the end", () => {
    const turns = [
      done(60),
      done(45),
      { totalScore: 20, completedAt: null, darts: [{}] },
    ];
    expect(firstNineAverageDisplay(turns)).toBe("52.5");
  });
});

describe("highestVisitScore", () => {
  it("returns 0 when there are no completed visits", () => {
    expect(highestVisitScore([])).toBe(0);
  });

  it("returns the single completed visit's score", () => {
    expect(highestVisitScore([done(60)])).toBe(60);
  });

  it("returns the max across several completed visits, not the last one", () => {
    expect(highestVisitScore([done(60), done(180), done(45)])).toBe(180);
  });

  it("ignores an open visit's running total", () => {
    const turns = [
      done(60),
      { totalScore: 180, completedAt: null, darts: [{}] },
    ];
    expect(highestVisitScore(turns)).toBe(60);
  });
});

describe("visitScoreBandCounts", () => {
  it("returns all-zero counts for no completed visits", () => {
    expect(visitScoreBandCounts([])).toEqual({
      sixtyPlus: 0,
      hundredPlus: 0,
      oneTwentyPlus: 0,
      oneFortyPlus: 0,
      oneEighties: 0,
    });
  });

  it("does not count a visit below 60 in any band", () => {
    expect(visitScoreBandCounts([done(59)])).toEqual({
      sixtyPlus: 0,
      hundredPlus: 0,
      oneTwentyPlus: 0,
      oneFortyPlus: 0,
      oneEighties: 0,
    });
  });

  it("counts a 60-99 visit as sixtyPlus only", () => {
    expect(visitScoreBandCounts([done(65)])).toEqual({
      sixtyPlus: 1,
      hundredPlus: 0,
      oneTwentyPlus: 0,
      oneFortyPlus: 0,
      oneEighties: 0,
    });
  });

  it("counts a visit in exactly its own band, not any lower one — the exclusive-band case (D238)", () => {
    expect(visitScoreBandCounts([done(125)])).toEqual({
      sixtyPlus: 0,
      hundredPlus: 0,
      oneTwentyPlus: 1,
      oneFortyPlus: 0,
      oneEighties: 0,
    });
  });

  it("a 100+ visit does not also increment sixtyPlus — the exclusive-band case extended", () => {
    expect(visitScoreBandCounts([done(105)])).toEqual({
      sixtyPlus: 0,
      hundredPlus: 1,
      oneTwentyPlus: 0,
      oneFortyPlus: 0,
      oneEighties: 0,
    });
  });

  it("tallies one visit into each of the four bands independently", () => {
    const turns = [done(105), done(125), done(145), done(180)];
    expect(visitScoreBandCounts(turns)).toEqual({
      sixtyPlus: 0,
      hundredPlus: 1,
      oneTwentyPlus: 1,
      oneFortyPlus: 1,
      oneEighties: 1,
    });
  });

  it("a 180 counts only as oneEighties, not also the lower three bands", () => {
    expect(visitScoreBandCounts([done(180)])).toEqual({
      sixtyPlus: 0,
      hundredPlus: 0,
      oneTwentyPlus: 0,
      oneFortyPlus: 0,
      oneEighties: 1,
    });
  });

  it("ignores an open visit even if its running total would clear a band", () => {
    const turns = [{ totalScore: 180, completedAt: null, darts: [{}] }];
    expect(visitScoreBandCounts(turns)).toEqual({
      sixtyPlus: 0,
      hundredPlus: 0,
      oneTwentyPlus: 0,
      oneFortyPlus: 0,
      oneEighties: 0,
    });
  });
});
