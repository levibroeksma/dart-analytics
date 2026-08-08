import { describe, expect, it } from "vitest";
import {
  boardScore,
  doublesPath,
  isHitOn,
  numbersPath,
  targetAt,
} from "@modules/game/board-progression.module";

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
