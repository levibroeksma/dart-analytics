import { describe, expect, it } from "vitest";
import { doublePreferenceBuckets } from "@modules/stats/sections/double-preference.module";
import { zoneCentroid } from "@lib/game/board/board-geometry.module";
import {
  ambiguousDart,
  CTX,
  dart,
  inferred,
  visit,
} from "../support/x01-inferred-fixtures";

describe("doublePreferenceBuckets", () => {
  it("sets how often a double is left beside how it is hit", () => {
    const sessions = inferred([
      visit(18, [dart("OUTER_SINGLE", 2, 2), dart("DOUBLE", 8, 16)]),
      visit(18, [dart("DOUBLE", 9, 18)]),
      visit(32, [dart("OUTER_SINGLE", 16, 16), dart("OUTER_SINGLE", 8, 8)]),
    ]);
    const [bucket] = doublePreferenceBuckets(sessions, CTX);
    expect(bucket!.metrics).toEqual({
      "DOUBLE:9|STATE": { left: 2, splitAway: 1 },
      "DOUBLE:9|NEAREST": { attempts: 1, hits: 1 },
      "DOUBLE:8|STATE": { left: 0, splitAway: 0 },
      "DOUBLE:8|SOLE": { attempts: 2, hits: 1 },
      "DOUBLE:16|STATE": { left: 1, splitAway: 0 },
      "DOUBLE:16|SOLE": { attempts: 1, hits: 0 },
    });
  });

  it("leaves darts with no finish available out", () => {
    const buckets = doublePreferenceBuckets(
      inferred([visit(501, [dart("TREBLE", 20, 60)])]),
      CTX,
    );
    expect(buckets).toEqual([]);
  });

  it("counts a dart ambiguous between D9 and S2 with the double nearer as left and AMBIGUOUS, not as an attempt", () => {
    const d9 = zoneCentroid(9, "DOUBLE")!;
    const s2 = zoneCentroid(2, "OUTER_SINGLE")!;
    const sessions = inferred([
      visit(18, [ambiguousDart(18, d9, s2, "FINISH")]),
      visit(32, [dart("DOUBLE", 16, 32)]),
    ]);
    const thrown = sessions[0]!.visits[0]!.darts[0]!;
    expect([thrown.resolution, thrown.basis]).toEqual(["AMBIGUOUS", "FINISH"]);
    const [bucket] = doublePreferenceBuckets(sessions, CTX);
    expect(bucket!.metrics).toEqual({
      "DOUBLE:9|STATE": { left: 1, splitAway: 0 },
      AMBIGUOUS: { darts: 1 },
      "DOUBLE:16|STATE": { left: 1, splitAway: 0 },
      "DOUBLE:16|SOLE": { attempts: 1, hits: 1 },
    });
    expect(bucket!.sampleSize).toBe(1);
  });

  it("also counts a dart ambiguous between D9 and S2 with the split nearer, as the finish was available", () => {
    const d9 = zoneCentroid(9, "DOUBLE")!;
    const s2 = zoneCentroid(2, "OUTER_SINGLE")!;
    const sessions = inferred([
      visit(18, [ambiguousDart(18, d9, s2, "SPLIT")]),
    ]);
    const thrown = sessions[0]!.visits[0]!.darts[0]!;
    expect([thrown.resolution, thrown.basis]).toEqual(["AMBIGUOUS", "SPLIT"]);
    const [bucket] = doublePreferenceBuckets(sessions, CTX);
    expect(bucket!.metrics).toEqual({
      "DOUBLE:9|STATE": { left: 1, splitAway: 0 },
      AMBIGUOUS: { darts: 1 },
    });
    expect(bucket!.sampleSize).toBe(0);
  });

  it("adds nothing for a dart thrown with no finish on", () => {
    const sessions = inferred([visit(501, [dart("TREBLE", 20, 60)])]);
    expect(doublePreferenceBuckets(sessions, CTX)).toEqual([]);
  });
});
