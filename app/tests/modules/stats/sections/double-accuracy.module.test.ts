import { describe, expect, it } from "vitest";
import { zoneCentroid } from "@lib/game/board/board-geometry.module";
import { doubleAccuracyBuckets } from "@modules/stats/sections/double-accuracy.module";
import {
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
});
