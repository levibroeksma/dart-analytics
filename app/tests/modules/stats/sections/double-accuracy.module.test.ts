import { describe, expect, it } from "vitest";
import { zoneCentroid } from "@lib/game/board/board-geometry.module";
import { doubleAccuracyBuckets } from "@modules/stats/sections/double-accuracy.module";
import {
  ambiguousDart,
  at,
  CTX,
  dart,
  inferred,
  scale,
  visit,
} from "../support/x01-inferred-fixtures";

describe("doubleAccuracyBuckets", () => {
  it("counts hits and classifies misses inside or outside the double", () => {
    const d16 = zoneCentroid(16, "DOUBLE")!;
    const inside = scale(d16, 150 / 166);
    const outside = scale(d16, 180 / 166);
    const sessions = inferred([
      visit(32, [at(inside.x, inside.y, "OUTER_SINGLE", 16, 16)]),
      visit(32, [
        at(outside.x, outside.y, "MISS", null, 0),
        dart("DOUBLE", 16, 32),
      ]),
    ]);
    const [bucket] = doubleAccuracyBuckets(sessions, CTX);
    const keys = Object.keys(bucket!.metrics).sort();
    expect(keys.filter((k) => k.startsWith("DOUBLE:16|SOLE|HIT"))).toHaveLength(
      1,
    );
    expect(keys.some((k) => k.startsWith("DOUBLE:16|SOLE|MISS|OUTSIDE|"))).toBe(
      true,
    );
    expect(keys.some((k) => k.startsWith("DOUBLE:16|SOLE|MISS|INSIDE|"))).toBe(
      true,
    );
    expect(bucket!.sampleSize).toBe(3);
  });

  it("leaves split-resolved darts out", () => {
    const [bucket] = doubleAccuracyBuckets(
      inferred([visit(18, [dart("OUTER_SINGLE", 2, 2)])]),
      CTX,
    );
    expect(bucket).toBeUndefined();
  });

  it("counts a bull finish under the inner-bull key", () => {
    const [bucket] = doubleAccuracyBuckets(
      inferred([visit(50, [at(0, 0, "INNER_BULL", 25, 50)])]),
      CTX,
    );
    expect(bucket!.metrics).toEqual({
      "INNER_BULL:25|NEAREST|HIT": { darts: 1 },
    });
    expect(bucket!.sampleSize).toBe(1);
  });

  it("counts a dart ambiguous between D9 and S2 with the double nearer under AMBIGUOUS only", () => {
    const d9 = zoneCentroid(9, "DOUBLE")!;
    const s2 = zoneCentroid(2, "OUTER_SINGLE")!;
    const ambiguous = ambiguousDart(18, d9, s2, "FINISH");
    const sessions = inferred([
      visit(18, [ambiguous]),
      visit(32, [dart("DOUBLE", 16, 32)]),
    ]);
    const thrown = sessions[0]!.visits[0]!.darts[0]!;
    expect([thrown.resolution, thrown.basis]).toEqual(["AMBIGUOUS", "FINISH"]);
    const [bucket] = doubleAccuracyBuckets(sessions, CTX);
    expect(bucket!.metrics).toEqual({
      "DOUBLE:16|SOLE|HIT": { darts: 1 },
      AMBIGUOUS: { darts: 1 },
    });
    expect(bucket!.sampleSize).toBe(1);
  });

  it("leaves a dart ambiguous between D9 and S2 with the split nearer out", () => {
    const d9 = zoneCentroid(9, "DOUBLE")!;
    const s2 = zoneCentroid(2, "OUTER_SINGLE")!;
    const sessions = inferred([
      visit(18, [ambiguousDart(18, d9, s2, "SPLIT")]),
    ]);
    const thrown = sessions[0]!.visits[0]!.darts[0]!;
    expect([thrown.resolution, thrown.basis]).toEqual(["AMBIGUOUS", "SPLIT"]);
    expect(doubleAccuracyBuckets(sessions, CTX)).toEqual([]);
  });
});
