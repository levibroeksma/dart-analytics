import { describe, expect, it } from "vitest";
import { missMargin } from "@lib/game/board/miss-margin.module";

describe("missMargin", () => {
  it("measures the distance from the intended zone centre", () => {
    const margin = missMargin({
      intendedTargetNumber: 20,
      intendedZoneKey: "TREBLE",
      locationX: 0,
      locationY: -92,
    });

    expect(margin).not.toBeNull();
    expect(margin!.distanceMm).toBeCloseTo(10, 6);
  });

  it("reports the bearing of the miss clockwise from vertical", () => {
    const margin = missMargin({
      intendedTargetNumber: 20,
      intendedZoneKey: "TREBLE",
      locationX: 10,
      locationY: -102,
    });

    expect(margin!.bearingDegrees).toBeCloseTo(90, 6);
  });

  it("returns null when the ruleset declared no intent", () => {
    expect(
      missMargin({
        intendedTargetNumber: null,
        intendedZoneKey: null,
        locationX: 0,
        locationY: -102,
      }),
    ).toBeNull();
  });

  it("returns null when the dart has no coordinate", () => {
    expect(
      missMargin({
        intendedTargetNumber: 20,
        intendedZoneKey: "TREBLE",
        locationX: null,
        locationY: null,
      }),
    ).toBeNull();
  });

  it("measures a bull miss from the board centre", () => {
    const margin = missMargin({
      intendedTargetNumber: 25,
      intendedZoneKey: "INNER_BULL",
      locationX: 3,
      locationY: -4,
    });

    expect(margin!.distanceMm).toBeCloseTo(5, 6);
  });

  it("measures a real distance against an inner-single intent", () => {
    const margin = missMargin({
      intendedTargetNumber: 20,
      intendedZoneKey: "INNER_SINGLE",
      locationX: 0,
      locationY: -46.45,
    });

    expect(margin).not.toBeNull();
    expect(margin!.distanceMm).toBeCloseTo(10, 6);
  });

  it("measures a real distance against an outer-single intent", () => {
    const margin = missMargin({
      intendedTargetNumber: 20,
      intendedZoneKey: "OUTER_SINGLE",
      locationX: 0,
      locationY: -124.5,
    });

    expect(margin).not.toBeNull();
    expect(margin!.distanceMm).toBeCloseTo(10, 6);
  });

  it("returns null against a bare unbanded single intent", () => {
    const margin = missMargin({
      intendedTargetNumber: 20,
      intendedZoneKey: "SINGLE",
      locationX: 0,
      locationY: -100,
    });

    expect(margin).toBeNull();
  });

  it("bearing 0 degrees when landing above the centroid", () => {
    const margin = missMargin({
      intendedTargetNumber: 20,
      intendedZoneKey: "TREBLE",
      locationX: 0,
      locationY: -112,
    });

    expect(margin).not.toBeNull();
    expect(margin!.bearingDegrees).toBeCloseTo(0, 6);
    expect(margin!.distanceMm).toBeCloseTo(10, 6);
  });

  it("bearing 180 degrees when landing below the centroid", () => {
    const margin = missMargin({
      intendedTargetNumber: 20,
      intendedZoneKey: "TREBLE",
      locationX: 0,
      locationY: -92,
    });

    expect(margin).not.toBeNull();
    expect(margin!.bearingDegrees).toBeCloseTo(180, 6);
    expect(margin!.distanceMm).toBeCloseTo(10, 6);
  });

  it("bearing 270 degrees when landing left of the centroid", () => {
    const margin = missMargin({
      intendedTargetNumber: 20,
      intendedZoneKey: "TREBLE",
      locationX: -10,
      locationY: -102,
    });

    expect(margin).not.toBeNull();
    expect(margin!.bearingDegrees).toBeCloseTo(270, 6);
    expect(margin!.distanceMm).toBeCloseTo(10, 6);
  });

  it("bearing 45 degrees when landing diagonally up-right", () => {
    const margin = missMargin({
      intendedTargetNumber: 20,
      intendedZoneKey: "TREBLE",
      locationX: 10,
      locationY: -112,
    });

    expect(margin).not.toBeNull();
    expect(margin!.bearingDegrees).toBeCloseTo(45, 6);
    expect(margin!.distanceMm).toBeCloseTo(Math.sqrt(200), 6);
  });
});
