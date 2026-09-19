import { describe, expect, it } from "vitest";
import { scoringAverageExcludingDoubles } from "@modules/stats/scoring-average.module";
import type {
  CheckoutVisitTotals,
  DartFact,
  PlayerVisitFactRow,
} from "@modules/types";

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

function dart(
  hitTargetNumber: number | null,
  hitZoneKey: DartFact["hitZoneKey"],
  score: number,
): DartFact {
  return {
    sequence: 1,
    intendedTargetNumber: null,
    intendedZoneKey: null,
    hitTargetNumber,
    hitZoneKey,
    score,
    locationX: null,
    locationY: null,
  };
}

describe("scoringAverageExcludingDoubles", () => {
  it("returns 0 for no visits", () => {
    expect(scoringAverageExcludingDoubles([], [])).toBe(0);
  });

  it("returns the plain 3-dart average when there is no dart-level double-out data", () => {
    const rows = [
      visit({ totalScore: 60, dartCount: 3 }),
      visit({ totalScore: 60, dartCount: 3 }),
    ];
    expect(scoringAverageExcludingDoubles(rows, [])).toBe(60);
  });

  it("excludes a successful double-attempt dart's score and count", () => {
    const rows = [visit({ totalScore: 140, dartCount: 3 })];
    const doubleOutVisits: CheckoutVisitTotals[] = [
      {
        // 140 -> 80 -> 20 remaining; the third dart opens at 20, an even
        // directly-finishable remaining, so it's a real double attempt.
        startingRemaining: 140,
        countedTotal: 140,
        darts: [
          dart(20, "TREBLE", 60),
          dart(20, "TREBLE", 60),
          dart(20, "DOUBLE", 20),
        ],
      },
    ];
    // 140 total over 3 darts, minus the 20-point double-attempt dart:
    // (140 - 20) / (3 - 1) * 3 = 180.
    expect(scoringAverageExcludingDoubles(rows, doubleOutVisits)).toBe(180);
  });

  it("excludes a missed double-attempt dart too, not just successful ones", () => {
    const rows = [visit({ totalScore: 60, dartCount: 3 })];
    const doubleOutVisits: CheckoutVisitTotals[] = [
      // 40 remaining, needs D20; single 20 is the same segment as the
      // required double -- a plausible errant shot at it (MISS), not a
      // lay-up (NOT_ATTEMPT).
      {
        startingRemaining: 40,
        countedTotal: 20,
        darts: [dart(20, "SINGLE", 20)],
      },
    ];
    // 60 total over 3 darts, minus the 20-point miss: (60 - 20) / (3 - 1) * 3 = 60.
    expect(scoringAverageExcludingDoubles(rows, doubleOutVisits)).toBe(60);
  });

  it("returns 0 rather than dividing by zero when every dart is excluded", () => {
    const rows = [visit({ totalScore: 40, dartCount: 1 })];
    const doubleOutVisits: CheckoutVisitTotals[] = [
      {
        startingRemaining: 40,
        countedTotal: 40,
        darts: [dart(20, "DOUBLE", 40)],
      },
    ];
    expect(scoringAverageExcludingDoubles(rows, doubleOutVisits)).toBe(0);
  });

  it("drops a busted visit's attempt dart from the denominator without subtracting a score the numerator never held", () => {
    // One 180 visit, then a visit that opened on 32 and busted with T20.
    // The busted visit stores total_score 0 while its dart keeps its real
    // 60 -- so the career numerator counted 180, not 240. Subtracting 60
    // from it would charge the player for points no total ever included.
    const rows = [
      visit({ totalScore: 180, dartCount: 3 }),
      visit({ turnSequence: 2, totalScore: 0, dartCount: 1 }),
    ];
    const doubleOutVisits: CheckoutVisitTotals[] = [
      {
        startingRemaining: 501,
        countedTotal: 180,
        darts: [
          dart(20, "TREBLE", 60),
          dart(20, "TREBLE", 60),
          dart(20, "TREBLE", 60),
        ],
      },
      {
        startingRemaining: 32,
        countedTotal: 0,
        darts: [dart(20, "TREBLE", 60)],
      },
    ];
    // 180 counted over 4 darts; the one attempt dart leaves the denominator
    // and takes nothing out of the numerator: 180 / (4 - 1) * 3 = 180.
    expect(scoringAverageExcludingDoubles(rows, doubleOutVisits)).toBe(180);
  });

  it("still subtracts an attempt dart whose own visit counted it", () => {
    const rows = [visit({ totalScore: 100, dartCount: 2 })];
    const doubleOutVisits: CheckoutVisitTotals[] = [
      {
        startingRemaining: 100,
        countedTotal: 100,
        darts: [dart(20, "TREBLE", 60), dart(20, "DOUBLE", 40)],
      },
    ];
    // (100 - 40) / (2 - 1) * 3 = 180.
    expect(scoringAverageExcludingDoubles(rows, doubleOutVisits)).toBe(180);
  });
});
