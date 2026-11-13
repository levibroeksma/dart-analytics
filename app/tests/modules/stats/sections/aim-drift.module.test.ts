import { describe, expect, it } from "vitest";
import { zoneCentroid } from "@lib/game/board/board-geometry.module";
import { aimDriftBuckets } from "@modules/stats/sections/aim-drift.module";
import {
  at,
  CTX,
  dart,
  inferred,
  visit,
} from "../support/x01-inferred-fixtures";

describe("aimDriftBuckets", () => {
  it("accumulates offset moments per basis, aim, dart number and resolution", () => {
    const centre = zoneCentroid(20, "TREBLE")!;
    const sessions = inferred([
      visit(501, [
        at(centre.x - 4, centre.y + 3, "TREBLE", 20, 60),
        at(centre.x - 2, centre.y, "TREBLE", 20, 60),
      ]),
      visit(381, [at(centre.x - 6, centre.y - 1, "TREBLE", 20, 60)]),
    ]);
    const [bucket] = aimDriftBuckets(sessions, CTX);
    const first = bucket!.metrics["LARGE_TARGET|TREBLE:20|1|NEAREST"]!;
    const expected = {
      n: 2,
      sumDx: -10,
      sumDy: 2,
      sumDxDx: 52,
      sumDyDy: 10,
      sumDxDy: -6,
    };
    for (const [field, value] of Object.entries(expected)) {
      expect(first[field]).toBeCloseTo(value);
    }
    expect(bucket!.metrics["LARGE_TARGET|TREBLE:20|2|NEAREST"]).toMatchObject({
      n: 1,
    });
    expect(
      bucket!.metrics["LARGE_TARGET|TREBLE:20|2|NEAREST"]!.sumDx,
    ).toBeCloseTo(-2);
    expect(
      bucket!.metrics["LARGE_TARGET|TREBLE:20|2|NEAREST"]!.sumDy,
    ).toBeCloseTo(0);
    expect(bucket!.sampleSize).toBe(3);
  });

  it("measures a wire aim from its edge point and a SOLE route aim too", () => {
    const sessions = inferred([visit(48, [dart("OUTER_SINGLE", 16, 16)])]);
    const [bucket] = aimDriftBuckets(sessions, CTX);
    expect(Object.keys(bucket!.metrics)).toEqual(["ROUTE|WIRE:8-16|1|SOLE"]);
  });

  it("counts an ambiguous dart under the AMBIGUOUS row outside the sample", () => {
    const sessions = inferred([visit(433, [dart("OUTER_SINGLE", 1, 1)])]);
    const [bucket] = aimDriftBuckets(sessions, CTX);
    expect(bucket!.metrics).toEqual({ AMBIGUOUS: { darts: 1 } });
    expect(bucket!.sampleSize).toBe(0);
  });

  it("sums a dart's offset from its aim point", () => {
    const t20 = zoneCentroid(20, "TREBLE")!;
    const sessions = inferred([
      visit(501, [at(t20.x + 1, t20.y + 2, "TREBLE", 20, 60)]),
    ]);
    const [bucket] = aimDriftBuckets(sessions, CTX);
    const row = bucket!.metrics["LARGE_TARGET|TREBLE:20|1|NEAREST"]!;
    expect(row.n).toBe(1);
    expect(row.sumDx).toBeCloseTo(1, 9);
    expect(row.sumDy).toBeCloseTo(2, 9);
    expect(row.sumDxDy).toBeCloseTo(2, 9);
    expect(row.sumDyDy).toBeCloseTo(4, 9);
  });
});
