import { describe, expect, it } from "vitest";
import {
  boardScore,
  clockPath,
  doublesPath,
  isHitOn,
  numbersPath,
  targetAt,
  boardTargetLabel,
} from "@modules/game/board-progression.module";
import type { DartObservation, DartZoneKey } from "@modules/types";

describe("board progression", () => {
  it("walks D1 to D20 then bull", () => {
    const path = doublesPath();
    expect(path).toHaveLength(21);
    expect(targetAt(path, 0)).toEqual({ kind: "DOUBLE", number: 1 });
    expect(targetAt(path, 19)).toEqual({ kind: "DOUBLE", number: 20 });
    expect(targetAt(path, 20)).toEqual({ kind: "BULL" });
  });

  it("walks 1 to 20 then bull", () => {
    expect(targetAt(numbersPath(), 0)).toEqual({ kind: "NUMBER", number: 1 });
    expect(targetAt(numbersPath(), 20)).toEqual({ kind: "BULL" });
  });

  it("throws for an index past the end of the path", () => {
    expect(() => targetAt(doublesPath(), 21)).toThrow(/No target at index 21/);
  });

  it("scores the board", () => {
    expect(boardScore(20, "SINGLE")).toBe(20);
    expect(boardScore(20, "DOUBLE")).toBe(40);
    expect(boardScore(20, "TREBLE")).toBe(60);
    expect(boardScore(25, "OUTER_BULL")).toBe(25);
    expect(boardScore(25, "INNER_BULL")).toBe(50);
    expect(boardScore(20, "MISS")).toBe(0);
    expect(boardScore(null, "SINGLE")).toBe(0);
  });

  it("recognises a hit on the required double", () => {
    const target = targetAt(doublesPath(), 0);
    expect(
      isHitOn(target, {
        hitTargetNumber: 1,
        hitZoneKey: "DOUBLE",
        locationX: null,
        locationY: null,
      }),
    ).toBe(true);
    expect(
      isHitOn(target, {
        hitTargetNumber: 1,
        hitZoneKey: "SINGLE",
        locationX: null,
        locationY: null,
      }),
    ).toBe(false);
    expect(
      isHitOn(target, {
        hitTargetNumber: 2,
        hitZoneKey: "DOUBLE",
        locationX: null,
        locationY: null,
      }),
    ).toBe(false);
  });

  it("counts any scoring ring as a hit on a NUMBER target", () => {
    const target = targetAt(numbersPath(), 4);
    expect(
      isHitOn(target, {
        hitTargetNumber: 5,
        hitZoneKey: "TREBLE",
        locationX: null,
        locationY: null,
      }),
    ).toBe(true);
    expect(
      isHitOn(target, {
        hitTargetNumber: 5,
        hitZoneKey: "MISS",
        locationX: null,
        locationY: null,
      }),
    ).toBe(false);
  });

  it("treats inner bull as a hit on the bull target and outer bull as a miss", () => {
    const bull = targetAt(doublesPath(), 20);
    expect(
      isHitOn(bull, {
        hitTargetNumber: 25,
        hitZoneKey: "INNER_BULL",
        locationX: null,
        locationY: null,
      }),
    ).toBe(true);
    expect(
      isHitOn(bull, {
        hitTargetNumber: 25,
        hitZoneKey: "OUTER_BULL",
        locationX: null,
        locationY: null,
      }),
    ).toBe(false);
  });
});

describe("numbersPath / doublesPath with an explicit order", () => {
  it("builds a NUMBER path from a given order, BULL wherever the sentinel sits", () => {
    const path = numbersPath([25, 3, 1]);
    expect(path).toEqual([
      { kind: "BULL" },
      { kind: "NUMBER", number: 3 },
      { kind: "NUMBER", number: 1 },
    ]);
  });

  it("builds a DOUBLE path from a given order, BULL wherever the sentinel sits", () => {
    const path = doublesPath([3, 25, 1]);
    expect(path).toEqual([
      { kind: "DOUBLE", number: 3 },
      { kind: "BULL" },
      { kind: "DOUBLE", number: 1 },
    ]);
  });

  it("falls back to the fixed ascending path when no order is given", () => {
    const ascending = [
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 25,
    ];
    expect(numbersPath()).toEqual(numbersPath(ascending));
    expect(doublesPath()).toEqual(doublesPath(ascending));
  });
});

describe("clockPath", () => {
  it("LOW_TO_HIGH", () => {
    expect(clockPath("LOW_TO_HIGH", false)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 25,
    ]);
  });

  it("HIGH_TO_LOW", () => {
    expect(clockPath("HIGH_TO_LOW", false)).toEqual([
      20, 19, 18, 17, 16, 15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 25,
    ]);
  });

  it("odds first, low to high", () => {
    expect(clockPath("LOW_TO_HIGH", true)).toEqual([
      1, 3, 5, 7, 9, 11, 13, 15, 17, 19, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 25,
    ]);
  });

  it("odds first, high to low", () => {
    expect(clockPath("HIGH_TO_LOW", true)).toEqual([
      19, 17, 15, 13, 11, 9, 7, 5, 3, 1, 20, 18, 16, 14, 12, 10, 8, 6, 4, 2, 25,
    ]);
  });
});

describe("boardTargetLabel", () => {
  it("labels a number target with its number", () => {
    expect(boardTargetLabel({ kind: "NUMBER", number: 20 })).toBe("20");
  });

  it("labels a double target D<n>", () => {
    expect(boardTargetLabel({ kind: "DOUBLE", number: 16 })).toBe("D16");
  });

  it("labels the bull BULL", () => {
    expect(boardTargetLabel({ kind: "BULL" })).toBe("BULL");
  });
});

describe("TREBLE board target", () => {
  const T20 = { kind: "TREBLE", number: 20 } as const;
  const obs = (
    hitTargetNumber: number | null,
    hitZoneKey: DartZoneKey,
  ): DartObservation => ({
    hitTargetNumber,
    hitZoneKey,
    locationX: null,
    locationY: null,
  });

  it("labels a treble target T<n>", () => {
    expect(boardTargetLabel(T20)).toBe("T20");
  });

  it("isHitOn counts only the treble of the target's number", () => {
    expect(isHitOn(T20, obs(20, "TREBLE"))).toBe(true);
    expect(isHitOn(T20, obs(20, "SINGLE"))).toBe(false);
    expect(isHitOn(T20, obs(20, "DOUBLE"))).toBe(false);
    expect(isHitOn(T20, obs(1, "TREBLE"))).toBe(false);
    expect(isHitOn(T20, obs(null, "MISS"))).toBe(false);
  });
});

describe("zone targets", () => {
  const on = (
    hitTargetNumber: number | null,
    hitZoneKey: DartZoneKey,
  ): DartObservation => ({
    hitTargetNumber,
    hitZoneKey,
    locationX: null,
    locationY: null,
  });

  it("ANY_DOUBLE hits any double and the bullseye, nothing else", () => {
    const anyDouble = { kind: "ANY_DOUBLE" } as const;
    expect(isHitOn(anyDouble, on(5, "DOUBLE"))).toBe(true);
    expect(isHitOn(anyDouble, on(25, "INNER_BULL"))).toBe(true);
    expect(isHitOn(anyDouble, on(25, "OUTER_BULL"))).toBe(false);
    expect(isHitOn(anyDouble, on(5, "TREBLE"))).toBe(false);
    expect(isHitOn(anyDouble, on(null, "MISS"))).toBe(false);
  });

  it("ANY_TREBLE hits any treble, nothing else", () => {
    const anyTreble = { kind: "ANY_TREBLE" } as const;
    expect(isHitOn(anyTreble, on(19, "TREBLE"))).toBe(true);
    expect(isHitOn(anyTreble, on(19, "DOUBLE"))).toBe(false);
    expect(isHitOn(anyTreble, on(25, "INNER_BULL"))).toBe(false);
  });

  it("labels zones in words", () => {
    expect(boardTargetLabel({ kind: "ANY_DOUBLE" })).toBe("Any double");
    expect(boardTargetLabel({ kind: "ANY_TREBLE" })).toBe("Any treble");
  });

  it("targetAt reads a path that mixes beds and zones", () => {
    expect(
      targetAt([{ kind: "NUMBER", number: 20 }, { kind: "ANY_TREBLE" }], 1),
    ).toEqual({ kind: "ANY_TREBLE" });
  });
});
