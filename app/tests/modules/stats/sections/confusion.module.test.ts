import { describe, it, expect } from "vitest";
import { confusionBuckets } from "@modules/stats/sections/confusion.module";
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

describe("confusionBuckets", () => {
  it("builds the landing distribution for an intended target, including a MISS hit key", () => {
    const rows = [
      row({ hitTargetNumber: 16, hitZoneKey: "DOUBLE", darts: 3 }),
      row({ hitTargetNumber: 8, hitZoneKey: "DOUBLE", darts: 2 }),
      row({ hitTargetNumber: null, hitZoneKey: "MISS", darts: 1 }),
    ];

    const [bucket] = confusionBuckets(rows, {
      to: "2026-02-01T00:00:00.000Z",
      now: new Date("2026-03-01T00:00:00.000Z"),
    });

    expect(bucket.metrics).toEqual({
      "DOUBLE:16": { "DOUBLE:16": 3, "DOUBLE:8": 2, MISS: 1 },
    });
    expect(bucket.sampleSize).toBe(6);
  });

  it("emits a single bucket=none-shaped bucket, not one per section catalog bucket", () => {
    const rows = [row({})];
    const buckets = confusionBuckets(rows, {
      to: "2026-02-01T00:00:00.000Z",
      now: new Date(),
    });
    expect(buckets).toHaveLength(1);
  });

  it("returns no buckets for an empty row set", () => {
    expect(
      confusionBuckets([], { to: "2026-02-01T00:00:00.000Z", now: new Date() }),
    ).toEqual([]);
  });
});
