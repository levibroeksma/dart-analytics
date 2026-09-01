import { describe, expect, it } from "vitest";
import { missMargin } from "@lib/game/board/miss-margin.module";
import { createDartRng } from "@modules/dartbot/rng.module";
import { skillProfileForLevel } from "@modules/dartbot/skill-profile.module";
import { throwDart } from "@modules/dartbot/throw-engine.module";
import type { ThrowIntent } from "@modules/types";
import {
  distanceHistogram,
  totalVariationDistance,
} from "./distribution-compare";

const T20_TREBLE: ThrowIntent = { targetNumber: 20, zoneKey: "TREBLE" };
const SAMPLE_SIZE = 5000;

function sampleMissDistances(level: number, seed: number): number[] {
  const profile = skillProfileForLevel(level);
  const distances: number[] = [];
  for (let i = 0; i < SAMPLE_SIZE; i++) {
    const rng = createDartRng(seed, i);
    const thrown = throwDart(T20_TREBLE, profile, rng);
    const margin = missMargin({
      intendedTargetNumber: 20,
      intendedZoneKey: "TREBLE",
      locationX: thrown.landing.x,
      locationY: thrown.landing.y,
    });
    distances.push(margin!.distanceMm);
  }
  return distances;
}

describe("distributional comparison — self-consistency", () => {
  it("scores two samples of the same level, different seeds, as the same distribution", () => {
    const a = distanceHistogram(sampleMissDistances(8, 111));
    const b = distanceHistogram(sampleMissDistances(8, 222));
    expect(totalVariationDistance(a, b)).toBeLessThan(0.05);
  });

  it("scores level 1 versus level 15 as a clearly different distribution", () => {
    const beginner = distanceHistogram(sampleMissDistances(1, 333));
    const elite = distanceHistogram(sampleMissDistances(15, 444));
    expect(totalVariationDistance(beginner, elite)).toBeGreaterThan(0.5);
  });

  it("scores adjacent levels 7 and 9 as detectably different", () => {
    const seven = distanceHistogram(sampleMissDistances(7, 555));
    const nine = distanceHistogram(sampleMissDistances(9, 666));
    expect(totalVariationDistance(seven, nine)).toBeGreaterThan(0.05);
  });

  it("a histogram's bins sum to 1", () => {
    const histogram = distanceHistogram(sampleMissDistances(8, 777));
    const total = histogram.reduce((sum, fraction) => sum + fraction, 0);
    expect(total).toBeCloseTo(1, 6);
  });
});
