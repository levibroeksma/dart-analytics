import { describe, expect, it } from "vitest";
import { largeTargetAccuracyBuckets } from "@modules/stats/sections/large-target-accuracy.module";
import { CTX, dart, inferred, visit } from "../support/x01-inferred-fixtures";

describe("largeTargetAccuracyBuckets", () => {
  it("counts large-target darts per aim and resolution", () => {
    const sessions = inferred([
      visit(501, [
        dart("TREBLE", 20, 60),
        dart("OUTER_SINGLE", 5, 5),
        dart("TREBLE", 1, 3),
      ]),
      visit(433, [
        dart("OUTER_SINGLE", 19, 19),
        dart("TREBLE", 19, 57),
        dart("DOUBLE", 20, 40),
      ]),
    ]);
    const [bucket] = largeTargetAccuracyBuckets(sessions, CTX);
    expect(bucket!.metrics).toEqual({
      "TREBLE:20|NEAREST": {
        darts: 3,
        trebles: 1,
        singles: 0,
        neighbourLeft: 1,
        neighbourRight: 0,
        other: 1,
      },
      "TREBLE:19|NEAREST": {
        darts: 2,
        trebles: 1,
        singles: 1,
        neighbourLeft: 0,
        neighbourRight: 0,
        other: 0,
      },
      AMBIGUOUS: { darts: 1 },
    });
    expect(bucket!.sampleSize).toBe(5);
  });

  it("ignores darts on any other basis", () => {
    expect(
      largeTargetAccuracyBuckets(
        inferred([visit(100, [dart("TREBLE", 20, 60)])]),
        CTX,
      ),
    ).toEqual([]);
  });
});
