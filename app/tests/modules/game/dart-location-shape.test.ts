import { describe, expect, it } from "vitest";
import type { DartFact, DartObservation } from "@modules/types";

describe("dart fact location pair", () => {
  it("accepts an observation carrying a landing point", () => {
    const observation: DartObservation = {
      hitTargetNumber: 20,
      hitZoneKey: "TREBLE",
      locationX: 0,
      locationY: -102,
    };
    expect(observation.locationY).toBe(-102);
  });

  it("accepts an observation with no landing point", () => {
    const observation: DartObservation = {
      hitTargetNumber: null,
      hitZoneKey: "MISS",
      locationX: null,
      locationY: null,
    };
    expect(observation.locationX).toBeNull();
  });

  it("carries the pair through to a persisted dart fact", () => {
    const fact: DartFact = {
      sequence: 1,
      intendedTargetNumber: null,
      intendedZoneKey: null,
      hitTargetNumber: 20,
      hitZoneKey: "TREBLE",
      score: 60,
      locationX: 0,
      locationY: -102,
    };
    expect(fact.score).toBe(60);
  });
});
