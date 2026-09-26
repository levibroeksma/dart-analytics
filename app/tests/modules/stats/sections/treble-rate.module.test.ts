import { describe, expect, it } from "vitest";
import { trebleRateBuckets } from "@modules/stats/sections/treble-rate.module";
import type { HitNumberCellRow } from "@modules/types";

const CTX = {
  to: "2026-02-01T00:00:00.000Z",
  now: new Date("2026-03-01T00:00:00.000Z"),
};

function row(overrides: Partial<HitNumberCellRow> = {}): HitNumberCellRow {
  return {
    bucketStart: "2026-01-01T00:00:00.000Z",
    bucketEnd: "2026-02-01T00:00:00.000Z",
    hitNumber: "20",
    darts: 10,
    trebles: 4,
    ...overrides,
  };
}

describe("trebleRateBuckets", () => {
  it("maps a row's fields one-to-one, keyed by hitNumber", () => {
    const [bucket] = trebleRateBuckets([row()], CTX);

    expect(bucket.metrics).toEqual({ "20": { darts: 10, trebles: 4 } });
    expect(bucket.sampleSize).toBe(10);
  });

  it("keys the miss row as MISS", () => {
    const [bucket] = trebleRateBuckets(
      [row({ hitNumber: "MISS", darts: 5, trebles: 0 })],
      CTX,
    );

    expect(bucket.metrics).toEqual({ MISS: { darts: 5, trebles: 0 } });
  });

  it("sums two rows for the same hit number in the same bucket", () => {
    const a = row({ hitNumber: "19", darts: 3, trebles: 1 });
    const b = row({ hitNumber: "19", darts: 2, trebles: 1 });

    const [bucket] = trebleRateBuckets([a, b], CTX);

    expect(bucket.metrics).toEqual({ "19": { darts: 5, trebles: 2 } });
  });

  it("keeps distinct hit numbers separate within a bucket", () => {
    const a = row({ hitNumber: "20", darts: 10, trebles: 4 });
    const b = row({ hitNumber: "19", darts: 5, trebles: 1 });

    const [bucket] = trebleRateBuckets([a, b], CTX);

    expect(bucket.metrics).toEqual({
      "20": { darts: 10, trebles: 4 },
      "19": { darts: 5, trebles: 1 },
    });
  });

  it("splits rows across two buckets", () => {
    const a = row();
    const b = row({
      bucketStart: "2026-02-01T00:00:00.000Z",
      bucketEnd: "2026-03-01T00:00:00.000Z",
    });

    expect(
      trebleRateBuckets([a, b], {
        to: "2026-03-01T00:00:00.000Z",
        now: new Date("2026-04-01T00:00:00.000Z"),
      }),
    ).toHaveLength(2);
  });
});
