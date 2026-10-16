import { describe, it, expect } from "vitest";
import {
  BULL_OFF_CROP_MM,
  botBullThrow,
  bullDistanceMm,
  bullOffResult,
  clampToCrop,
  coinRotation,
  coinWinner,
  tossCoin,
} from "@modules/game/starter.module";

describe("bull-off", () => {
  it("crops out to the trebles at 115mm", () => {
    expect(BULL_OFF_CROP_MM).toBe(115);
  });

  it("clamps to the crop radius", () => {
    const clamped = clampToCrop({ x: 300, y: 0 });
    expect(clamped.x).toBeCloseTo(111);
    expect(clamped.y).toBeCloseTo(0);
    expect(clampToCrop({ x: 10, y: -20 })).toEqual({ x: 10, y: -20 });
  });

  it("measures distance from the bull", () => {
    expect(bullDistanceMm({ x: 3, y: 4 })).toBe(5);
  });

  it("closer dart wins", () => {
    expect(bullOffResult({ x: 2, y: 0 }, { x: 0, y: 9 })).toBe(0);
    expect(bullOffResult({ x: 20, y: 0 }, { x: 0, y: 9 })).toBe(1);
  });

  it("ties within 1mm", () => {
    expect(bullOffResult({ x: 10, y: 0 }, { x: 0, y: 10.9 })).toBe("tie");
  });

  it("both clamped darts tie", () => {
    expect(
      bullOffResult(
        clampToCrop({ x: 400, y: 0 }),
        clampToCrop({ x: 0, y: -500 }),
      ),
    ).toBe("tie");
  });

  it("bot throw stays within 37mm of the bull", () => {
    for (const r of [0, 0.25, 0.5, 0.999]) {
      const point = botBullThrow(() => r);
      expect(bullDistanceMm(point)).toBeGreaterThanOrEqual(3 - 1e-9);
      expect(bullDistanceMm(point)).toBeLessThanOrEqual(37);
    }
  });
});

describe("coin toss", () => {
  it("tossCoin splits at 0.5", () => {
    expect(tossCoin(() => 0.49)).toBe("heads");
    expect(tossCoin(() => 0.5)).toBe("tails");
  });

  it("caller wins on a correct call", () => {
    expect(coinWinner("heads", "heads")).toBe(0);
    expect(coinWinner("heads", "tails")).toBe(1);
  });

  it("rotation spins five turns and lands tails a half turn on", () => {
    expect(coinRotation(0, "heads")).toBe(1800);
    expect(coinRotation(0, "tails")).toBe(1980);
    expect(coinRotation(1980, "heads")).toBe(3600);
  });
});
