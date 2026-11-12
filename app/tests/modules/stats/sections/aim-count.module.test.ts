import { describe, expect, it } from "vitest";
import {
  addCounts,
  AMBIGUOUS_KEY,
  aimCountBuckets,
  aimKey,
} from "@modules/stats/sections/aim-count.module";
import { CTX, dart, inferred, visit } from "../support/x01-inferred-fixtures";

describe("aim-count helpers", () => {
  it("joins key parts with a pipe", () => {
    expect(aimKey("TREBLE:20", "NEAREST")).toBe("TREBLE:20|NEAREST");
    expect(aimKey("DOUBLE:16", 3)).toBe("DOUBLE:16|3");
    expect(AMBIGUOUS_KEY).toBe("AMBIGUOUS");
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
});
