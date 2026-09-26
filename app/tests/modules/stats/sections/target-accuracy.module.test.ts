import { describe, it, expect } from "vitest";
import { targetAccuracyBuckets } from "@modules/stats/sections/target-accuracy.module";
import type { IntentCellRow } from "@modules/types";

function row(overrides: Partial<IntentCellRow>): IntentCellRow {
  return {
    bucketStart: "2026-01-01T00:00:00.000Z",
    bucketEnd: "2026-02-01T00:00:00.000Z",
    intendedTargetNumber: 16,
    intendedZoneKey: "DOUBLE",
    hitTargetNumber: 16,
    hitZoneKey: "DOUBLE",
    darts: 1,
    ...overrides,
  };
}

describe("targetAccuracyBuckets", () => {
  it("sums attempts and hits per target across two rows of the same bucket", () => {
    const rows = [
      row({ hitTargetNumber: 16, hitZoneKey: "DOUBLE", darts: 5 }),
      row({ hitTargetNumber: 8, hitZoneKey: "DOUBLE", darts: 3 }),
    ];

    const [bucket] = targetAccuracyBuckets(rows, {
      to: "2026-02-01T00:00:00.000Z",
      now: new Date("2026-03-01T00:00:00.000Z"),
    });

    expect(bucket.metrics["DOUBLE:16"]).toEqual({ attempts: 8, hits: 5 });
    expect(bucket.sampleSize).toBe(8);
  });

  it("returns no buckets for an empty row set", () => {
    expect(
      targetAccuracyBuckets([], {
        to: "2026-02-01T00:00:00.000Z",
        now: new Date(),
      }),
    ).toEqual([]);
  });
});
