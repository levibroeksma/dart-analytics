import { describe, expect, it } from "vitest";
import {
  effectiveDartsForVisit,
  firstNineCareerAverage,
  highestGameAverage,
  medianVisitScore,
  scoreBandCounts,
  totalDartsThrown,
} from "@modules/stats/visit-stats.module";
import type { PlayerVisitFactRow } from "@modules/types";

function visit(
  overrides: Partial<PlayerVisitFactRow> = {},
): PlayerVisitFactRow {
  return {
    sessionId: "session-1",
    gameTypeKey: "501",
    stageId: "stage-1",
    stageTypeKey: "LEG",
    turnSequence: 1,
    totalScore: 60,
    dartCount: 3,
    configuredMaxDartsPerTurn: 3,
    ...overrides,
  };
}

describe("effectiveDartsForVisit", () => {
  it("uses the real dart count when it is present", () => {
    expect(effectiveDartsForVisit(visit({ dartCount: 1 }))).toBe(1);
  });

  it("falls back to the configured max when dartCount is 0", () => {
    expect(
      effectiveDartsForVisit(
        visit({ dartCount: 0, configuredMaxDartsPerTurn: 3 }),
      ),
    ).toBe(3);
  });

  it("falls back to 3 when neither the real count nor the configured max is known", () => {
    expect(
      effectiveDartsForVisit(
        visit({ dartCount: 0, configuredMaxDartsPerTurn: null }),
      ),
    ).toBe(3);
  });
});

describe("totalDartsThrown", () => {
  it("returns 0 for no visits", () => {
    expect(totalDartsThrown([])).toBe(0);
  });

  it("sums effective darts across visits", () => {
    const rows = [visit({ dartCount: 3 }), visit({ dartCount: 0 })];
    expect(totalDartsThrown(rows)).toBe(6);
  });
});

describe("scoreBandCounts", () => {
  it("counts each visit in exactly its highest band", () => {
    const rows = [
      visit({ totalScore: 180 }),
      visit({ totalScore: 140 }),
      visit({ totalScore: 120 }),
      visit({ totalScore: 100 }),
      visit({ totalScore: 59 }),
    ];
    expect(scoreBandCounts(rows)).toEqual({
      hundredPlus: 1,
      oneTwentyPlus: 1,
      oneFortyPlus: 1,
      oneEighties: 1,
    });
  });

  it("returns all zeros for no visits", () => {
    expect(scoreBandCounts([])).toEqual({
      hundredPlus: 0,
      oneTwentyPlus: 0,
      oneFortyPlus: 0,
      oneEighties: 0,
    });
  });
});

describe("medianVisitScore", () => {
  it("returns 0 for no visits", () => {
    expect(medianVisitScore([])).toBe(0);
  });

  it("returns the middle value for an odd count", () => {
    const rows = [
      visit({ totalScore: 10 }),
      visit({ totalScore: 60 }),
      visit({ totalScore: 30 }),
    ];
    expect(medianVisitScore(rows)).toBe(30);
  });

  it("averages the two middle values for an even count", () => {
    const rows = [
      visit({ totalScore: 10 }),
      visit({ totalScore: 20 }),
      visit({ totalScore: 30 }),
      visit({ totalScore: 40 }),
    ];
    expect(medianVisitScore(rows)).toBe(25);
  });
});

describe("highestGameAverage", () => {
  it("returns 0 for no visits", () => {
    expect(highestGameAverage([])).toBe(0);
  });

  it("picks the session with the highest 3-dart average", () => {
    const rows = [
      visit({ sessionId: "a", totalScore: 60, dartCount: 3 }),
      visit({ sessionId: "a", totalScore: 60, dartCount: 3 }),
      visit({ sessionId: "b", totalScore: 20, dartCount: 3 }),
    ];
    expect(highestGameAverage(rows)).toBe(60);
  });
});

describe("firstNineCareerAverage", () => {
  it("returns 0 for no visits", () => {
    expect(firstNineCareerAverage([])).toBe(0);
  });

  it("pools only the first 3 turns of each session", () => {
    const rows = [
      visit({ sessionId: "a", turnSequence: 1, totalScore: 60 }),
      visit({ sessionId: "a", turnSequence: 2, totalScore: 60 }),
      visit({ sessionId: "a", turnSequence: 3, totalScore: 60 }),
      visit({ sessionId: "a", turnSequence: 4, totalScore: 0 }),
      visit({ sessionId: "b", turnSequence: 1, totalScore: 30 }),
    ];
    expect(firstNineCareerAverage(rows)).toBe(52.5);
  });
});
