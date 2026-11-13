import { describe, expect, it } from "vitest";
import {
  addCounts,
  AMBIGUOUS_KEY,
  aimCountBuckets,
  aimCountDartBuckets,
  aimKey,
  countAimed,
  sumSessionDarts,
} from "@modules/stats/sections/aim-count.module";
import { mergeMetrics } from "@lib/stats/merge-metrics";
import { largeTargetAccuracyBuckets } from "@modules/stats/sections/large-target-accuracy.module";
import type { AimCountMetrics, InferredSession } from "@modules/types";
import { CTX, dart, inferred, visit } from "../support/x01-inferred-fixtures";

function inMonth(sessions: InferredSession[], month: "01" | "02") {
  return sessions.map((s) => ({
    ...s,
    bucketStart: `2026-${month}-01T00:00:00.000Z`,
    bucketEnd: `2026-${month === "01" ? "02" : "03"}-01T00:00:00.000Z`,
  }));
}

describe("aim-count helpers", () => {
  it("joins key parts with a pipe", () => {
    expect(aimKey("TREBLE:20", "NEAREST")).toBe("TREBLE:20|NEAREST");
    expect(aimKey("DOUBLE:16", 3)).toBe("DOUBLE:16|3");
    expect(AMBIGUOUS_KEY).toBe("AMBIGUOUS");
  });

  it("sums a fold over every dart of every visit", () => {
    const [session] = inferred([
      visit(501, [dart("TREBLE", 20, 60), dart("TREBLE", 20, 60)]),
      visit(381, [dart("TREBLE", 20, 60)]),
    ]);
    expect(sumSessionDarts(session!, () => 2)).toBe(6);
  });

  it("counts a dart without an aim as ambiguous and returns an aimed dart's count", () => {
    const [ambiguous] = inferred([visit(433, [dart("OUTER_SINGLE", 1, 1)])])[0]!
      .visits[0]!.darts;
    const [aimed] = inferred([visit(501, [dart("TREBLE", 20, 60)])])[0]!
      .visits[0]!.darts;
    const metrics: AimCountMetrics = {};
    expect(countAimed(metrics, ambiguous!, () => 5)).toBe(0);
    expect(
      countAimed(metrics, aimed!, (aim) => (aim.key === "TREBLE:20" ? 1 : 9)),
    ).toBe(1);
    expect(metrics).toEqual({ [AMBIGUOUS_KEY]: { darts: 1 } });
  });

  it("adds counts onto a row, creating it when absent", () => {
    const metrics = {};
    addCounts(metrics, "k", { darts: 1, hits: 0 });
    addCounts(metrics, "k", { darts: 2, other: 1 });
    expect(metrics).toEqual({ k: { darts: 3, hits: 0, other: 1 } });
  });

  it("sums fold contributions into sampleSize and drops empty buckets", () => {
    const sessions = inferred([visit(501, [dart("TREBLE", 20, 60)])]);
    const [bucket] = aimCountBuckets(sessions, CTX, (metrics) => {
      addCounts(metrics, "k", { n: 2 });
      return 2;
    });
    expect(bucket!.sampleSize).toBe(2);
    expect(aimCountBuckets(sessions, CTX, () => 0)).toEqual([]);
  });

  it("keeps a bucket holding only ambiguous counts", () => {
    const sessions = inferred([visit(433, [dart("OUTER_SINGLE", 1, 1)])]);
    const [bucket] = aimCountBuckets(sessions, CTX, (metrics) => {
      addCounts(metrics, AMBIGUOUS_KEY, { darts: 1 });
      return 0;
    });
    expect(bucket!.sampleSize).toBe(0);
    expect(bucket!.metrics).toEqual({ AMBIGUOUS: { darts: 1 } });
  });

  it("merges two month chunks into the combined request, ambiguous-only month included", () => {
    const january = inMonth(
      inferred([visit(501, [dart("TREBLE", 20, 60)])]),
      "01",
    );
    const february = inMonth(
      inferred([visit(433, [dart("OUTER_SINGLE", 1, 1)])]),
      "02",
    );
    const chunks = [january, february].map((chunk) =>
      largeTargetAccuracyBuckets(chunk, CTX),
    );
    expect(chunks[1]).toHaveLength(1);
    expect(chunks[1]![0]!.sampleSize).toBe(0);
    const merged = mergeMetrics(
      "large-target-accuracy",
      chunks[0]![0]!.metrics,
      chunks[1]![0]!.metrics,
    );
    const combined = largeTargetAccuracyBuckets(
      inMonth([...january, ...february], "01"),
      CTX,
    );
    expect(merged).toEqual(combined[0]!.metrics);
    expect(merged.AMBIGUOUS).toEqual({ darts: 1 });
  });

  it("folds dart by dart through aimCountDartBuckets", () => {
    const sessions = inferred([
      visit(501, [dart("TREBLE", 20, 60), dart("TREBLE", 20, 60)]),
      visit(433, [dart("OUTER_SINGLE", 1, 1)]),
    ]);
    const [bucket] = aimCountDartBuckets(sessions, CTX, (metrics, thrown) =>
      countAimed(metrics, thrown, (aim) => {
        addCounts(metrics, aim.key, { darts: 1 });
        return 1;
      }),
    );
    expect(bucket!.metrics).toEqual({
      "TREBLE:20": { darts: 2 },
      AMBIGUOUS: { darts: 1 },
    });
    expect(bucket!.sampleSize).toBe(2);
  });

  it("counts a large-target dart on the left neighbour under neighbourLeft", () => {
    const sessions = inferred([visit(501, [dart("OUTER_SINGLE", 5, 5)])]);
    const [bucket] = largeTargetAccuracyBuckets(sessions, CTX);
    expect(bucket!.metrics["TREBLE:20|NEAREST"]).toMatchObject({
      darts: 1,
      neighbourLeft: 1,
      neighbourRight: 0,
    });
  });
});
