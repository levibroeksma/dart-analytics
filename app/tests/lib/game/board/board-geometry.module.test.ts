import { describe, expect, it } from "vitest";
import {
  BOARD_RADII_MM,
  classify,
  zoneCentroid,
} from "@lib/game/board/board-geometry.module";

describe("classify", () => {
  it("puts the origin in the inner bull", () => {
    expect(classify(0, 0)).toEqual({
      targetNumber: 25,
      zoneKey: "INNER_BULL",
      score: 50,
    });
  });

  it("puts a point just outside the inner bull in the outer bull", () => {
    expect(classify(0, -7)).toEqual({
      targetNumber: 25,
      zoneKey: "OUTER_BULL",
      score: 25,
    });
  });

  it("scores the treble of 20 straight up", () => {
    expect(classify(0, -102)).toEqual({
      targetNumber: 20,
      zoneKey: "TREBLE",
      score: 60,
    });
  });

  it("scores the double of 20 straight up", () => {
    expect(classify(0, -166)).toEqual({
      targetNumber: 20,
      zoneKey: "DOUBLE",
      score: 40,
    });
  });

  it("scores the inner single of 20", () => {
    expect(classify(0, -50)).toEqual({
      targetNumber: 20,
      zoneKey: "SINGLE",
      score: 20,
    });
  });

  it("scores the outer single of 20", () => {
    expect(classify(0, -130)).toEqual({
      targetNumber: 20,
      zoneKey: "SINGLE",
      score: 20,
    });
  });

  it("scores 3 straight down", () => {
    expect(classify(0, 130)).toEqual({
      targetNumber: 3,
      zoneKey: "SINGLE",
      score: 3,
    });
  });

  it("scores 6 straight right", () => {
    expect(classify(130, 0)).toEqual({
      targetNumber: 6,
      zoneKey: "SINGLE",
      score: 6,
    });
  });

  it("scores 11 straight left", () => {
    expect(classify(-130, 0)).toEqual({
      targetNumber: 11,
      zoneKey: "SINGLE",
      score: 11,
    });
  });

  it("returns a miss with no target number beyond the double ring", () => {
    expect(classify(0, -180)).toEqual({
      targetNumber: null,
      zoneKey: "MISS",
      score: 0,
    });
  });

  it("returns a miss beyond the surround", () => {
    expect(classify(0, -300)).toEqual({
      targetNumber: null,
      zoneKey: "MISS",
      score: 0,
    });
  });

  it("treats each ring boundary as belonging to the outer ring", () => {
    expect(classify(0, -BOARD_RADII_MM.innerBull).zoneKey).toBe("OUTER_BULL");
    expect(classify(0, -BOARD_RADII_MM.outerBull).zoneKey).toBe("SINGLE");
    expect(classify(0, -BOARD_RADII_MM.trebleInner).zoneKey).toBe("TREBLE");
    expect(classify(0, -BOARD_RADII_MM.trebleOuter).zoneKey).toBe("SINGLE");
    expect(classify(0, -BOARD_RADII_MM.doubleInner).zoneKey).toBe("DOUBLE");
    expect(classify(0, -BOARD_RADII_MM.doubleOuter).zoneKey).toBe("MISS");
  });

  it("splits neighbouring sectors at the 9 degree boundary", () => {
    const radius = 130;
    const justInside = (9 - 0.5) * (Math.PI / 180);
    const justOutside = (9 + 0.5) * (Math.PI / 180);
    expect(
      classify(radius * Math.sin(justInside), -radius * Math.cos(justInside))
        .targetNumber,
    ).toBe(20);
    expect(
      classify(radius * Math.sin(justOutside), -radius * Math.cos(justOutside))
        .targetNumber,
    ).toBe(1);
  });
});

describe("zoneCentroid", () => {
  it("puts the treble 20 centroid on the upward vertical", () => {
    const centroid = zoneCentroid(20, "TREBLE");
    expect(centroid).not.toBeNull();
    expect(centroid!.x).toBeCloseTo(0, 6);
    expect(centroid!.y).toBeCloseTo(-102, 6);
  });

  it("puts the inner bull centroid at the origin", () => {
    expect(zoneCentroid(25, "INNER_BULL")).toEqual({ x: 0, y: 0 });
  });

  it("has no centroid for a miss", () => {
    expect(zoneCentroid(null, "MISS")).toBeNull();
  });
});
