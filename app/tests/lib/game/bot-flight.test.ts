import { describe, it, expect } from "vitest";
import {
  botFlightSchedule,
  dartLabel,
  observationPercent,
} from "@lib/game/bot-flight";
import type { DartObservation } from "@modules/types";

const dart = (
  hitZoneKey: DartObservation["hitZoneKey"],
  hitTargetNumber: number | null,
  locationX: number | null = 0,
  locationY: number | null = 0,
): DartObservation => ({ hitZoneKey, hitTargetNumber, locationX, locationY });

describe("botFlightSchedule", () => {
  it("splits 900ms into aim 590, fly 240, hit 70", () => {
    expect(botFlightSchedule(900)).toEqual({
      aimMs: 590,
      flyMs: 240,
      hitMs: 70,
    });
  });

  it("floors aim at 0 for short pacing", () => {
    expect(botFlightSchedule(100)).toEqual({ aimMs: 0, flyMs: 240, hitMs: 70 });
  });
});

describe("observationPercent", () => {
  it("puts the bull at the board centre", () => {
    expect(observationPercent(dart("INNER_BULL", 25, 0, 0))).toEqual({
      leftPercent: 50,
      topPercent: 50,
    });
  });

  it("maps millimetres over the 220mm half extent", () => {
    expect(observationPercent(dart("TREBLE", 20, 0, -103))).toEqual({
      leftPercent: 50,
      topPercent: ((-103 + 220) / 440) * 100,
    });
  });

  it("is null for a dart with no location", () => {
    expect(observationPercent(dart("MISS", null, null, null))).toBeNull();
  });
});

describe("dartLabel", () => {
  it.each([
    [dart("TREBLE", 20), "T20"],
    [dart("DOUBLE", 16), "D16"],
    [dart("SINGLE", 5), "S5"],
    [dart("INNER_SINGLE", 1), "S1"],
    [dart("OUTER_SINGLE", 19), "S19"],
    [dart("OUTER_BULL", 25), "S25"],
    [dart("INNER_BULL", 25), "BULL"],
    [dart("MISS", null), "MISS"],
  ])("labels %o as %s", (observation, label) => {
    expect(dartLabel(observation)).toBe(label);
  });
});
