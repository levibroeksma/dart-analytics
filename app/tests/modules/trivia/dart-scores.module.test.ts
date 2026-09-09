import { describe, it, expect, vi, afterEach } from "vitest";
import {
  ONE_DART_SCORES,
  getRandomDartScore,
} from "@modules/trivia/dart-scores.module";

describe("ONE_DART_SCORES", () => {
  it("contains every reachable one-dart score exactly once, sorted ascending", () => {
    expect(ONE_DART_SCORES[0]).toBe(1);
    expect(ONE_DART_SCORES[ONE_DART_SCORES.length - 1]).toBe(60);
    expect(new Set(ONE_DART_SCORES).size).toBe(ONE_DART_SCORES.length);
    expect([...ONE_DART_SCORES]).toEqual(
      [...ONE_DART_SCORES].sort((a, b) => a - b),
    );
    expect(ONE_DART_SCORES).toContain(25);
    expect(ONE_DART_SCORES).toContain(50);
    expect(ONE_DART_SCORES).not.toContain(23); // not a single (>20), double, treble, or bull
    expect(ONE_DART_SCORES).not.toContain(41); // not a single (>20), double, treble, or bull
  });
});

describe("getRandomDartScore", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 1 when maxScore is 1 (the only reachable score)", () => {
    expect(getRandomDartScore(1)).toBe(1);
  });

  it("never returns a score greater than maxScore", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.999);
    expect(getRandomDartScore(10)).toBeLessThanOrEqual(10);
  });

  it("throws when no reachable score is at most maxScore", () => {
    expect(() => getRandomDartScore(0)).toThrow();
  });
});
