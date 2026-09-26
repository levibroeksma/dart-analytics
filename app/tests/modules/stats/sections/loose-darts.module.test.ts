import { describe, it, expect } from "vitest";
import {
  classifyLanding,
  looseDartsBuckets,
} from "@modules/stats/sections/loose-darts.module";
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

describe("classifyLanding", () => {
  const cases: {
    aimNumber: number;
    aimZone: string;
    hitNumber: number | null;
    hitZone: string;
    expected: "onTarget" | "nearMiss" | "loose";
  }[] = [
    {
      aimNumber: 20,
      aimZone: "DOUBLE",
      hitNumber: 20,
      hitZone: "DOUBLE",
      expected: "onTarget",
    },
    {
      aimNumber: 20,
      aimZone: "DOUBLE",
      hitNumber: 1,
      hitZone: "DOUBLE",
      expected: "nearMiss",
    },
    {
      aimNumber: 20,
      aimZone: "DOUBLE",
      hitNumber: 5,
      hitZone: "DOUBLE",
      expected: "nearMiss",
    },
    {
      aimNumber: 20,
      aimZone: "DOUBLE",
      hitNumber: 20,
      hitZone: "OUTER_SINGLE",
      expected: "nearMiss",
    },
    {
      aimNumber: 20,
      aimZone: "DOUBLE",
      hitNumber: 1,
      hitZone: "OUTER_SINGLE",
      expected: "loose",
    },
    {
      aimNumber: 20,
      aimZone: "DOUBLE",
      hitNumber: 20,
      hitZone: "TREBLE",
      expected: "loose",
    },
    {
      aimNumber: 20,
      aimZone: "DOUBLE",
      hitNumber: null,
      hitZone: "MISS",
      expected: "loose",
    },
    {
      aimNumber: 25,
      aimZone: "INNER_BULL",
      hitNumber: 25,
      hitZone: "OUTER_BULL",
      expected: "nearMiss",
    },
    {
      aimNumber: 25,
      aimZone: "INNER_BULL",
      hitNumber: 20,
      hitZone: "INNER_SINGLE",
      expected: "loose",
    },
  ];

  for (const c of cases) {
    it(`${c.aimZone}:${c.aimNumber} -> ${c.hitZone}:${c.hitNumber} is ${c.expected}`, () => {
      expect(
        classifyLanding(
          { number: c.aimNumber, zone: c.aimZone as never },
          { number: c.hitNumber, zone: c.hitZone as never },
        ),
      ).toBe(c.expected);
    });
  }
});

describe("looseDartsBuckets", () => {
  it("partitions exactly: onTarget + nearMiss + loose === attempts", () => {
    const rows = [
      row({ hitTargetNumber: 16, hitZoneKey: "DOUBLE", darts: 9 }),
      row({ hitTargetNumber: 8, hitZoneKey: "DOUBLE", darts: 12 }),
      row({ hitTargetNumber: null, hitZoneKey: "MISS", darts: 9 }),
    ];

    const [bucket] = looseDartsBuckets(rows, {
      to: "2026-02-01T00:00:00.000Z",
      now: new Date("2026-03-01T00:00:00.000Z"),
    });

    const entry = bucket.metrics["DOUBLE:16"];
    expect(entry.onTarget + entry.nearMiss + entry.loose).toBe(30);
    expect(entry).toEqual({ onTarget: 9, nearMiss: 12, loose: 9 });
  });

  it("returns no buckets for an empty row set", () => {
    expect(
      looseDartsBuckets([], {
        to: "2026-02-01T00:00:00.000Z",
        now: new Date(),
      }),
    ).toEqual([]);
  });
});
