import { describe, it, expect } from "vitest";
import {
  intendedKey,
  hitKey,
  isHit,
} from "@modules/stats/sections/intent-cells.module";
import { isHitOn } from "@modules/game/board-progression.module";
import type {
  BoardTarget,
  DartObservation,
  IntentCellRow,
} from "@modules/types";

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

describe("intendedKey / hitKey", () => {
  it("formats the intended pair as a TargetKey", () => {
    expect(intendedKey(row({}))).toBe("DOUBLE:16");
    expect(
      intendedKey(
        row({ intendedTargetNumber: 25, intendedZoneKey: "INNER_BULL" }),
      ),
    ).toBe("INNER_BULL:25");
  });

  it("formats a MISS hit as the literal MISS", () => {
    expect(hitKey(row({ hitTargetNumber: null, hitZoneKey: "MISS" }))).toBe(
      "MISS",
    );
  });

  it("formats a non-miss hit as a TargetKey", () => {
    expect(
      hitKey(row({ hitTargetNumber: 8, hitZoneKey: "OUTER_SINGLE" })),
    ).toBe("OUTER_SINGLE:8");
  });
});

describe("isHit parity with isHitOn", () => {
  const observations: DartObservation[] = [
    {
      hitTargetNumber: 16,
      hitZoneKey: "DOUBLE",
      locationX: null,
      locationY: null,
    },
    {
      hitTargetNumber: 16,
      hitZoneKey: "OUTER_SINGLE",
      locationX: null,
      locationY: null,
    },
    {
      hitTargetNumber: 16,
      hitZoneKey: "TREBLE",
      locationX: null,
      locationY: null,
    },
    {
      hitTargetNumber: 16,
      hitZoneKey: "INNER_SINGLE",
      locationX: null,
      locationY: null,
    },
    {
      hitTargetNumber: 8,
      hitZoneKey: "DOUBLE",
      locationX: null,
      locationY: null,
    },
    {
      hitTargetNumber: 25,
      hitZoneKey: "INNER_BULL",
      locationX: null,
      locationY: null,
    },
    {
      hitTargetNumber: 25,
      hitZoneKey: "OUTER_BULL",
      locationX: null,
      locationY: null,
    },
    {
      hitTargetNumber: null,
      hitZoneKey: "MISS",
      locationX: null,
      locationY: null,
    },
  ];

  it("agrees with isHitOn for every intended pair these engines store", () => {
    const intents: {
      target: BoardTarget;
      targetNumber: number;
      zoneKey: string;
    }[] = [
      ...Array.from({ length: 20 }, (_, i) => ({
        target: { kind: "DOUBLE", number: i + 1 } as BoardTarget,
        targetNumber: i + 1,
        zoneKey: "DOUBLE",
      })),
      {
        target: { kind: "BULL" } as BoardTarget,
        targetNumber: 25,
        zoneKey: "INNER_BULL",
      },
    ];

    for (const intent of intents) {
      for (const observation of observations) {
        const cellRow = row({
          intendedTargetNumber: intent.targetNumber,
          intendedZoneKey: intent.zoneKey,
          hitTargetNumber: observation.hitTargetNumber,
          hitZoneKey: observation.hitZoneKey,
        });
        expect(isHit(cellRow)).toBe(isHitOn(intent.target, observation));
      }
    }
  });
});
