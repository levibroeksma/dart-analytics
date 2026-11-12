import { describe, expect, it } from "vitest";
import { setupSuccessBuckets } from "@modules/stats/sections/setup-success.module";
import { zoneCentroid } from "@lib/game/board/board-geometry.module";
import {
  ambiguousDart,
  CTX,
  dart,
  inferred,
  visit,
} from "../support/x01-inferred-fixtures";

describe("setupSuccessBuckets", () => {
  it("counts setup darts per basis and kind, and good leaves per visit", () => {
    const sessions = inferred([
      visit(48, [
        dart("OUTER_SINGLE", 16, 16),
        dart("OUTER_SINGLE", 16, 16),
        dart("OUTER_SINGLE", 8, 8),
      ]),
      visit(100, [
        dart("OUTER_SINGLE", 20, 20),
        dart("OUTER_SINGLE", 20, 20),
        dart("OUTER_SINGLE", 20, 20),
      ]),
      visit(501, [
        dart("TREBLE", 20, 60),
        dart("TREBLE", 20, 60),
        dart("TREBLE", 20, 60),
      ]),
    ]);
    const [bucket] = setupSuccessBuckets(sessions, CTX);
    expect(bucket!.metrics["ROUTE|WIRE|SOLE"]).toEqual({
      attempts: 1,
      hits: 1,
    });
    expect(bucket!.metrics["ROUTE|TREBLE|SOLE"]).toEqual({
      attempts: 2,
      hits: 0,
    });
    expect(bucket!.metrics["SETUP|SINGLE|SOLE"]).toEqual({
      attempts: 1,
      hits: 1,
    });
    expect(bucket!.metrics.VISITS).toEqual({ visits: 2, goodLeaves: 2 });
  });

  it("adds no visit row for a finished or busted visit", () => {
    const buckets = setupSuccessBuckets(
      inferred([
        visit(40, [dart("DOUBLE", 20, 40)]),
        visit(16, [dart("OUTER_SINGLE", 16, 16)]),
      ]),
      CTX,
    );
    expect(buckets).toEqual([]);
  });

  it("counts a dart ambiguous between D9 and S2 with the split nearer under AMBIGUOUS only", () => {
    const d9 = zoneCentroid(9, "DOUBLE")!;
    const s2 = zoneCentroid(2, "OUTER_SINGLE")!;
    const sessions = inferred([
      visit(18, [ambiguousDart(18, d9, s2, "SPLIT")]),
      visit(100, [dart("TREBLE", 20, 60)]),
    ]);
    const thrown = sessions[0]!.visits[0]!.darts[0]!;
    expect([thrown.resolution, thrown.basis]).toEqual(["AMBIGUOUS", "SPLIT"]);
    const [bucket] = setupSuccessBuckets(sessions, CTX);
    const aimRows = Object.keys(bucket!.metrics).filter(
      (key) => key !== "AMBIGUOUS" && key !== "VISITS",
    );
    expect(aimRows).toEqual(["ROUTE|TREBLE|SOLE"]);
    expect(bucket!.metrics.AMBIGUOUS).toEqual({ darts: 1 });
    expect(bucket!.sampleSize).toBe(1);
  });

  it("leaves a dart ambiguous between D9 and S2 with the double nearer out", () => {
    const d9 = zoneCentroid(9, "DOUBLE")!;
    const s2 = zoneCentroid(2, "OUTER_SINGLE")!;
    const sessions = inferred([
      visit(18, [ambiguousDart(18, d9, s2, "FINISH")]),
    ]);
    const thrown = sessions[0]!.visits[0]!.darts[0]!;
    expect([thrown.resolution, thrown.basis]).toEqual(["AMBIGUOUS", "FINISH"]);
    const [bucket] = setupSuccessBuckets(sessions, CTX);
    expect(bucket?.metrics.AMBIGUOUS).toBeUndefined();
  });
});
