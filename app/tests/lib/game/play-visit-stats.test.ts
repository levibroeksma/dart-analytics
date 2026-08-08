import { describe, it, expect } from "vitest";
import {
  previousScoreDisplay,
  dartsThrownCount,
  perVisitAverageDisplay,
  threeDartAverageDisplay,
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

describe("dartsThrownCount", () => {
  it("returns 0 for zero turns", () => {
    expect(dartsThrownCount(0, 3)).toBe(0);
  });

  it("multiplies turn count by maxDartsPerTurn", () => {
    expect(dartsThrownCount(2, 3)).toBe(6);
  });

  it("honours a non-default maxDartsPerTurn", () => {
    expect(dartsThrownCount(2, 4)).toBe(8);
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
