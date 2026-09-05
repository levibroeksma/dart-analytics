import { describe, expect, it } from "vitest";
import { classifyDoubleAttempts } from "@modules/game/double-attempt.module";
import type { DartFact } from "@modules/types";

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

describe("classifyDoubleAttempts", () => {
  it("returns zero hits and misses for an empty log", () => {
    expect(classifyDoubleAttempts([])).toEqual({ hits: 0, misses: 0 });
  });

  it("does not count a dart thrown while the remaining score is odd", () => {
    // 121 left after this scoring dart -> the dart itself opened at 121,
    // odd, no double can finish it in one dart.
    const visits = [
      { startingRemaining: 121, darts: [dart(20, "TREBLE", 60)] },
    ];
    expect(classifyDoubleAttempts(visits)).toEqual({ hits: 0, misses: 0 });
  });

  it("does not count a dart thrown while the remaining score is even but over 40 and not 50", () => {
    const visits = [{ startingRemaining: 82, darts: [dart(14, "TREBLE", 42)] }];
    expect(classifyDoubleAttempts(visits)).toEqual({ hits: 0, misses: 0 });
  });

  it("counts a checkout on the required double as a hit", () => {
    const visits = [{ startingRemaining: 40, darts: [dart(20, "DOUBLE", 40)] }];
    expect(classifyDoubleAttempts(visits)).toEqual({ hits: 1, misses: 0 });
  });

  it("counts hitting the inner bull at 50 remaining as a hit", () => {
    const visits = [
      { startingRemaining: 50, darts: [dart(25, "INNER_BULL", 50)] },
    ];
    expect(classifyDoubleAttempts(visits)).toEqual({ hits: 1, misses: 0 });
  });

  it("counts a double hit that doesn't check out (wrong double) as a miss", () => {
    const visits = [{ startingRemaining: 40, darts: [dart(5, "DOUBLE", 10)] }];
    expect(classifyDoubleAttempts(visits)).toEqual({ hits: 0, misses: 1 });
  });

  it("counts hitting outer bull while going for the inner bull at 50 as a miss", () => {
    const visits = [
      { startingRemaining: 50, darts: [dart(25, "OUTER_BULL", 25)] },
    ];
    expect(classifyDoubleAttempts(visits)).toEqual({ hits: 0, misses: 1 });
  });

  it("counts a single hit on the same segment as the required double as a miss (36 left, inner single 18)", () => {
    const visits = [
      { startingRemaining: 36, darts: [dart(18, "INNER_SINGLE", 18)] },
    ];
    expect(classifyDoubleAttempts(visits)).toEqual({ hits: 0, misses: 1 });
  });

  it("counts a single hit on a board-adjacent segment to the required double as a miss (32 left, needs D16, hits single 7)", () => {
    const visits = [{ startingRemaining: 32, darts: [dart(7, "SINGLE", 7)] }];
    expect(classifyDoubleAttempts(visits)).toEqual({ hits: 0, misses: 1 });
  });

  it("counts a treble hit board-adjacent to the required double as a miss", () => {
    const visits = [{ startingRemaining: 32, darts: [dart(7, "TREBLE", 21)] }];
    expect(classifyDoubleAttempts(visits)).toEqual({ hits: 0, misses: 1 });
  });

  it("does not count a single hit on an unrelated segment as an attempt (18 left, needs D9, hits single 2 -- a deliberate reroute to D16)", () => {
    const visits = [{ startingRemaining: 18, darts: [dart(2, "SINGLE", 2)] }];
    expect(classifyDoubleAttempts(visits)).toEqual({ hits: 0, misses: 0 });
  });

  it("does not count a large single far from bull as an attempt at 50 (a deliberate split)", () => {
    const visits = [
      { startingRemaining: 50, darts: [dart(18, "OUTER_SINGLE", 18)] },
    ];
    expect(classifyDoubleAttempts(visits)).toEqual({ hits: 0, misses: 0 });
  });

  it("does not count a coordinate-less bounce-out miss as an attempt", () => {
    const visits = [{ startingRemaining: 40, darts: [dart(null, "MISS", 0)] }];
    expect(classifyDoubleAttempts(visits)).toEqual({ hits: 0, misses: 0 });
  });

  it("tracks remaining score across multiple darts in one visit", () => {
    // 40 left: dart 1 hits inner single 20 (miss, same segment as D20),
    // remaining now 20; dart 2 hits D10 -> checks out (hit).
    const visits = [
      {
        startingRemaining: 40,
        darts: [dart(20, "INNER_SINGLE", 20), dart(10, "DOUBLE", 20)],
      },
    ];
    expect(classifyDoubleAttempts(visits)).toEqual({ hits: 1, misses: 1 });
  });

  it("sums hits and misses across several visits", () => {
    const visits = [
      { startingRemaining: 40, darts: [dart(20, "DOUBLE", 40)] }, // hit
      { startingRemaining: 32, darts: [dart(7, "SINGLE", 7)] }, // miss
      { startingRemaining: 18, darts: [dart(2, "SINGLE", 2)] }, // not an attempt
    ];
    expect(classifyDoubleAttempts(visits)).toEqual({ hits: 1, misses: 1 });
  });
});
